# The server, and how the game is split

## Running it

```
node server.js                 # then open http://localhost:8787
PORT=9000 node server.js       # somewhere else
HOST=0.0.0.0 node server.js    # so the rest of the house can join in
```

No dependencies. One port serves three things:

| | |
|---|---|
| `GET /` | the game — `index.html` and the scripts beside it |
| `GET/PUT/DELETE /campaign[/name]`, `GET /campaigns` | campaigns, kept on the server |
| `ws:// /ws` | the lobby, and every battle in progress |

The server's own source, the saved campaigns and anything hidden are not served.

## The split

The game used to be one file. `game.js` held the turn structure, the OpFor AI,
the isometric renderer and the console UI in a single closure, which meant the
rules could only run inside a browser — and therefore only on the machine of
whoever happened to be playing.

It is now in two halves:

**`engine.js` is the game.** Every decision and every die roll is in it, and
nothing in it draws. It runs under node on the server, where it is the authority
on what happened, and it runs in the browser too, so a solitaire or hotseat game
goes down exactly the same path as a game played across the world.

**`game.js` is the view.** It draws the table, animates what it is told, and
turns taps into intents. It decides nothing. Where it used to call `doShoot`,
it now sends `{k: 'target', id}` and waits to be told what happened.

Between them sits a **transport** (`net.js`), in two flavours that speak the
same messages:

- `PMCNet.Remote` — a WebSocket to a server running the engine.
- `PMCNet.Local` — the engine in this tab, behind the same message names, for
  solitaire, hotseat and the published single-file build, which has no server.

Because both speak one protocol, the board has one path through it, and a
solitaire game exercises the same code a networked one does.

### What crosses the wire

An intent goes up. What comes back is a pair:

```
{ t: 'turn', seq, events: [...], state: {...} }
```

The **events** are what happened, in the order it happened — log lines, dice
cards, effects, movement paths, shots. The client replays them at the speed the
animations take, which is what makes a shot look like a shot rather than a
number changing. The **state** is the truth, and the board settles onto it once
the show has caught up. A client that has just joined, or one that missed a
message, is never more than one snapshot away from being right.

The vocabulary of intents is in `engine.js` under `function intent`, and the
message names are in `protocol.js`, which both halves load so neither can drift.

### Two things that changed behaviour

- **Result cards no longer block the game.** A card used to sit on screen until
  the player pressed Continue, and the phase carried on from the button. The
  server cannot wait on a button, so a rally phase now resolves in one go and
  the cards go out as data for each client to page through at its own pace.
- **The OpFor no longer thinks on a timer.** Its whole turn resolves at once and
  the client replays it. It still acts one unit at a time on screen.

## The files

```
index.html           the game
viewer.html          the unit viewer, a bench for looking at one at a time
server.js            the entry point: static files, campaigns, the upgrade to ws

src/rules/           the rulebook: profiles, scenarios, campaigns, terrain
src/engine/          the game, and the words it answers in
src/view/            the browser: everything that draws, and the screens
src/net/             the wire, and the screen that arranges a game over it

server/ws.js         RFC 6455, both ends of it, no dependencies
server/static.js     handing the app out
server/lobby.js      players, rooms, seats, chat — knows no rules
server/table.js      one battle: room settings in, events and state out
server/campaigns.js  campaigns as JSON files, one per campaign
server/rules.js      loading the browser modules under node

test/unit/           what `npm test` runs: no browser, no network
test/browser/        driven through a real browser: `npm run test:browser`
test/where.js        where the tests are, relative to everything else

scripts/             build, gallery, and the tools that performed the split
build/               the built pages (kept, so a clone can play); shots/ is not kept
docs/                design notes
```

src/ is split by what a file is rather than by what it belongs to: the rulebook
is arithmetic, the engine decides, the view draws, and the net carries. The
first two run under node as well as in a browser, which is what lets the server
be the authority; the last two only ever run in a browser.

`scripts/build-engine.js` and `scripts/strip-game.js` are how `engine.js` was
lifted out of `game.js`. They have done their job — `engine.js` is the source
now, and editing `game.js` will not regenerate it.

## A game, end to end

1. Both players open the server's page and press **Multiplayer**. The button is
   hidden when the page did not come from a server, because then there is
   nothing to connect to.
2. One starts a game and reads the five-letter code out. The other joins, and
   takes the free seat; anyone after that watches.
3. The host sets the terms — Battle Tier, Priority Level, planet, scenario, and
   a campaign if the battle belongs to one. Changing the terms unreadies both
   sides, deliberately.
4. Each player builds a force on the muster screen, which the lobby borrows.
5. Both press ready; the host takes the field. From that moment the server rolls
   the terrain, the scenario, the initiative and every die after it.
6. If somebody's wifi drops mid-battle their seat is held, and the same browser
   walks back into it and is sent the table again.

## Tests

`npm test` runs the rules tests as before, and then:

- `enginetest.js` — whole battles driven by intent, every scenario, all four
  factions, plus the intents a player is not allowed to send and a snapshot
  round trip. The terrain set-up is laid area by area with the turn order
  enforced, and a garrison is checked to still hold its building after the
  table has crossed the wire.
- `clienttest.js` — the page booted without a browser, against a faked document
  and a clock the test winds on: every script loads, a battle plays to a result
  through the board's own hooks, and the lobby screen is driven against a real
  lobby running in the same process.
- `servertest.js` — two players on two real sockets against the real server:
  the handshake, the lobby, the chat, setup, a battle to a result, and a
  reconnect in the middle of it.
