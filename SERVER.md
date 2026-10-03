# The server, and how the game is split

## Running it

```
node server.js                 # then open http://localhost:8787
PORT=9000 node server.js       # somewhere else
HOST=0.0.0.0 node server.js    # so the rest of the house can join in
DATA_DIR=/var/lib/pmc node server.js           # the database (accounts, battles, campaigns) kept outside the code
BACKUP_DIR=... BACKUP_KEEP=7 node server.js    # the database's daily copies (backups/ beside it); BACKUPS=off for none
PUBLIC_URL=... SMTP_HOST=... node server.js    # email: account activation, password resets (deploy/pi/README.md)
CAMPAIGNS_DIR=/var/lib/pmc node server.js      # the campaigns kept outside the code
ALLOWED_ORIGINS=https://example.org node server.js   # pages elsewhere allowed to open the socket
```

To keep one running on a Raspberry Pi behind nginx (at `https://<domain>/pmc/`),
deployed to by GitHub on every push to `main` (or any branch, by hand), see
[deploy/pi/README.md](deploy/pi/README.md).

Two packages, `better-sqlite3` for the database and `nodemailer` for email (`npm ci --omit=dev`). One port serves:

| | |
|---|---|
| `GET /` | the game — `index.html` and the scripts beside it |
| `GET/PUT/DELETE /campaign[/name]`, `GET /campaigns` | campaigns, kept on the server |
| `POST /api/register`, `/api/login`, `/api/guest`, `/api/logout`, `/api/password`; `GET /api/me`, `/api/games` | accounts, and a guest's name for a battle |
| `POST /api/activate`, `/api/resend`, `/api/forgot`, `/api/reset`, `/api/rename`, `/api/email`, `/api/confirm-email` | the emailed links (activation, a password reset, a new address), and a new name |
| `GET/POST /api/campaigns`, `GET/PUT/DELETE /api/campaigns/<id>`, `POST /api/campaigns/import` | a signed-in player's own campaigns, each save over the version it was read at |
| `ws:// /ws` | the lobby, and every battle in progress (signed in, or as a guest) |
| `GET /health` | up or not: rooms, players, seconds up, the last backup, whether mail goes out |

The server's own source, the saved campaigns and anything hidden are not served.

### What it guards against

- **A bad request does not take it down.** A malformed URL is refused; anything
  thrown and not caught is logged and the server carries on; SIGTERM and SIGINT
  close it cleanly.
- **Who a player is comes from their session.** Accounts are a name, an email
  address (one account each) and a password (scrypt, salted). Where mail is set
  up (`PUBLIC_URL` and `SMTP_*`, or `MAIL_OUTBOX` to write it to a folder), a new
  account waits for the link mailed to it; the links (activation, password reset,
  a new address) are kept only as hashes, work once and run out, always point at
  `PUBLIC_URL`, and Forgot password says the same whether or not an address has an
  account. Mail asked for is limited per address and per account; a session is a random token in an `HttpOnly`,
  `SameSite=Lax` cookie (`Secure` behind TLS), kept only as a hash, 30 days and
  renewed as it is used. The socket is opened only with a session (an account's,
  or a guest's for a one-off battle): its identity is the session's, never what
  the connection says. Rooms show only a public id. Wrong passwords are limited
  per name and per address. Accounts are looked after with `server/admin.js`.
- **Campaign writes need the campaign's key.** The first `PUT` of a campaign is
  answered with a key (`{ ok, key }`); every later `PUT` or `DELETE` must send it
  in an `x-campaign-key` header, or is refused (403). The key is kept hashed
  beside the campaign. Another site's page cannot read it, so it cannot write.
- **Each side's secrets stay theirs.** Every battle update is sent to each
  seat with the other side's secrets left out, and to watchers with both sides'
  left out (`server/hidden.js`): swaps noted but not yet made, the mined piece,
  a campaign force's bench; in a room, the other player's list.
- **The socket is for this server's own pages.** An upgrade whose `Origin` is not
  the host it was asked for (or the one a proxy names in `X-Forwarded-Host`, or
  one listed in `ALLOWED_ORIGINS`) is refused.
- **One connection cannot flood it.** At most 40 messages a second, 8 chat lines
  in 10 seconds and 12 rooms made or joined a minute; over that, the message is
  dropped and the sender told, and a connection that keeps on is closed. A
  refused intent sends the whole table back at most once a second.
- **Rooms do not pile up.** A finished battle puts its room back in setup for a
  rematch; a battle that cannot be laid out goes back to setup with the reason;
  a room nobody is connected to is closed after 10 minutes.
- **Battles survive a restart.** Every battle is kept in the database as it is
  played (its config, its own seeded dice, every intent); a restart plays each
  one in progress back to where it was and holds the seats for the players. A
  battle nobody has been at for half an hour is put away and comes back when a
  player goes back to it ("Your games" in the lobby). Leaving a battle is a
  forfeit.

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
  solitaire, hotseat and the single-file build, which has no server.

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
server.js            the entry point: the HTTP server, the socket, shutting down
server/app.js        what it answers over HTTP: the app, the accounts, the campaign routes, /health
server/db.js         the database (better-sqlite3): its migrations and every query
server/auth.js       accounts, sessions and guests
server/admin.js      the accounts from the command line: users, stats, reset a password, activate, back up
server/backups.js    the database copied once a day, the last week kept
server/mail.js       the email (nodemailer, or a folder for trying it out)
server/hidden.js     what each seat (and a watcher) may see of a battle and a room
server/games.js      the battles kept in the database: begun, each intent, the end, a player's own

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

scripts/             build, gallery, the test runner, and the tools that performed the split
build/               the built pages, made by `npm run build` (not kept in git)
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
   greyed out when the page did not come from a server, because then there is
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

`npm test` runs every unit test (see the README for the runner). Three of them
are about the split:

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
