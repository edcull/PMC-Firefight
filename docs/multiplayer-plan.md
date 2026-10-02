# Multiplayer: review and plan

Two players on two devices: one-off online battles, and online campaigns, with a database for games and campaigns and simple user accounts. This reviews the server as it stands on `main` (a214171 plus the docs since) and plans the work. It builds on the hotseat plan (`docs/hotseat-review.md`): the two-player campaign model is done there first, and reused here.

## 1. Where it stands

**Works today**
- A zero-dependency Node server (`server.js`): static files, a hand-rolled WebSocket (`server/ws.js`), a lobby with public and private rooms, chat, host-set terms, forces, ready/start (`server/lobby.js`).
- Server-authoritative battles: one engine per table, the server rolls every die, every intent checked against the seat (`server/table.js`, `engine.js` handlers); events and a snapshot go to both players and to watchers.
- A dropped player's seat is held (in battle, indefinitely; in setup, 3 minutes); a reload rejoins by the id in localStorage. Abandon ends it for both.
- Sub-path deployment behind nginx; the Pi deploy (systemd, sandboxed data dir) and CI.
- Tests: `servertest.js` (a whole battle over real sockets, reconnect), `clienttest.js` (lobby), browser `netplay.js`, `nettakeover.js`, `subpath.js`.

**Not there**
- **Nothing is stored but campaign JSON files.** Rooms and battles live in memory: a restart loses every game.
- **No identity.** A player is whatever `playerId` their browser sends.
- **Online campaigns do not work.** A battle can be fought "under" a server campaign, but its report is only filed; the aftermath is never applied, the turn never moves, there is no contract, both companies live in one document that anyone may overwrite, and the dossier knows only an unnamed `default` campaign through a hand-set URL.

## 2. Findings

| ID | Sev | Finding | Where |
|---|---|---|---|
| MP-1 | Critical | A malformed percent-encoding in a URL crashes the server process (`decodeURIComponent` unguarded; no `uncaughtException` handler). One request takes the server down. | `server.js:69`, `server/static.js:46` |
| MP-2 | Critical | Identity spoofing: `playerId` comes from the client, every id in a room is broadcast to everyone in it, and a second `hello` rewrites the id on a live connection. A watcher can become host (kick, change terms, start) or take a dropped player's seat. | `server/lobby.js:76-84, 181-205` |
| MP-3 | Critical | Campaign `PUT`/`DELETE` with no auth and CORS `*`: any web page a player visits can overwrite or delete campaigns. A crafted campaign can also put unescaped names on the board (possible stored XSS; `panels.js:140-161`, `input.js:281`, the game-over card). | `server.js:47-86` |
| MP-4 | High | No persistence of rooms or battles; a restart loses all play. | `server/lobby.js`, `server/table.js` |
| MP-5 | High | The online campaign loop is missing: no contract, no per-player company ownership, aftermath never applied, faction and colour taken from the client, composition unchecked for campaign picks. | `server/table.js:113-135`, `server/campaigns.js:77-85` |
| MP-6 | High | Campaign writes are whole-document, last-writer-wins, synchronous and non-atomic. | `server/campaigns.js` |
| MP-7 | Medium | Room lifecycle: a finished room can never be played again; a failed start leaves a room stuck in battle; rooms with both players gone are never cleared and count against the 64-room cap. | `server/lobby.js:281-284, 379-418` |
| MP-8 | Medium | No rate limits, no WebSocket `Origin` check, no per-IP caps: chat floods, refused-intent resync amplification, filling the room cap, brute-forcing private codes. | `server/ws.js:187-210`, `server/table.js:220` |
| MP-9 | Medium | Every snapshot carries the whole state to both players and watchers: no hidden information is possible (secret swaps, hidden lists). | `src/engine/save.js:129-214` |
| MP-10 | Low | Skirmish lists that fail the composition check are silently re-rolled rather than refused; sync fs on the hot path; protocol comment and log drift; campaign name clamped to 24 in the lobby but 40 on disk. | `server/table.js:139-142`, `protocol.js` |

## 3. Design

### Database
- **SQLite, through Node's built-in `node:sqlite`** (no new dependency; one file in the existing data dir, `/var/lib/pmc-firefight`). It needs Node 22.5 or later (the Pi deploy says 20: raise it). It is marked experimental in Node 22; a thin data layer (`server/db.js`) keeps the queries in one place, so `better-sqlite3` (one dependency) can stand in if that is preferred.
- Schema, migrated by a numbered list in `server/db.js` (`user_version` pragma):

| Table | Holds |
|---|---|
| `users` | id, name (unique, case-insensitive), password hash, created, last seen, admin flag |
| `sessions` | token hash, user id, created, expires, last used |
| `games` | id, code, kind (skirmish / campaign), campaign id, status (setup / battle / over / abandoned), settings, seat A user, seat B user, engine config, dice seed, result, created, updated |
| `game_intents` | game id, sequence, seat, intent, time — the battle replayed from these after a restart |
| `campaigns` | id, name, owner, invite code, status, turn, version, shared state (the world: turn, records, reports), created, updated |
| `campaign_members` | campaign id, user id, side (A / B) |
| `companies` | campaign id, side, the company (the dossier), version |
| `contracts` | campaign id, turn, terms (Tier, scenario, Priority Level, roles), each side's pick, status (picking / ready / fought) |
| `battle_reports` | campaign id, turn, game id, report, applied flag |

- Battles are stored the way the hotseat save already works (`net.js` `Local`): the config, a dice seed and every accepted intent. On restart, each unfinished game is rebuilt by replaying its intents with the same seeded dice — no engine snapshot format to keep stable. This needs the server's dice seeded per game (they use `Math.random` today).

### Accounts
- **Name and password**, nothing else (no email). Passwords hashed with `crypto.scrypt` (built in), a per-user salt; login attempts rate-limited per name and per IP.
- **Sessions:** a random 32-byte token, stored hashed, sent as an `HttpOnly`, `SameSite=Lax`, `Secure` (behind TLS) cookie; 30 days, renewed on use; logout deletes it.
- **The WebSocket is authenticated at the upgrade** from the same cookie, with an `Origin` check (the cookie makes cross-site socket hijacking possible otherwise). The player's identity is the user id from the session — never anything the client sends. Ids are not broadcast: rooms show names and seats.
- Routes: `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`. Password change for a logged-in user; a reset by an admin from the command line (`node server/admin.js reset-password <name>`), as there is no email.
- Guests (decision 2): either everyone registers, or one-off battles may be played as a guest (a session with no account, lost when the browser forgets it); campaigns always need an account.

### Online battles
- A game row is made when a room is created; the seats are user ids. Starting writes the config and seed; each accepted intent is appended (in a transaction, before the result is sent out). A restart rebuilds every open game; players reconnect into it from any device once logged in.
- "My games": a list of the player's open games (resume, abandon), and finished ones with their result.
- Room lifecycle: a finished room offers a rematch or closes; a failed start goes back to setup with the reason; rooms with nobody connected are closed after a time (setup) or kept as stored games (battle) without holding a room slot.
- Abandoning records a forfeit (the other side wins) — decision 5.

### Online campaigns
- Built on the two-player campaign model from the hotseat plan (Player 2 a player, a dossier per player, an aftermath per player, a saved contract).
- **The server owns the campaign rules.** The campaign code already runs under Node (`server/rules.js` loads `campaign.js`). Clients send commands — recruit, disband, promote, take an honour or upgrade, choose a doctrine, pick a force, answer an aftermath question — and the server checks each with the same functions the dossier uses, writes the result and tells both players. No client uploads a whole campaign again.
- Each player can change only their own company; a company has a version number, and a stale write is refused (and the screen refreshed).
- **The loop:**
  1. Between battles, each player manages their own company, whenever they like (asynchronous).
  2. Either player calls for a contract: the server rolls the terms (Tier, scenario, Priority Level, roles), runs On Our Terms…, Foresighted Command and The Best Defence as questions to the player who holds them, and saves the contract.
  3. Each player picks their force on their own device (hidden from the other until both are ready — decision 4).
  4. The battle is created from the contract and played as an online battle (both online at once).
  5. When it ends, the server applies the aftermath once (by game id, so a retry cannot apply it twice), asks each player their own post-battle questions, and moves the turn on.
- Inviting: a campaign has an invite code; the second player joins with it and founds their company. An existing campaign (a local one, or a server JSON file) can be imported by its owner.

### Hidden information (decision 4)
- Per-seat snapshots: the server sends each player a copy of the state with the other side's secrets left out (held swaps, a hidden list before both are ready, a secret mine). Watchers see only what both players see. Needed for the secret parts of the rules to mean anything online.

## 4. Plan

Phases 0–2 can run alongside the hotseat work; phase 3 waits for the hotseat campaign model (hotseat phases 2 and 4).

### Phase 0 — harden what is there
- MP-1: guard every `decodeURIComponent`; a top-level error handler that logs and keeps serving; clean shutdown on SIGTERM/SIGINT.
- MP-2 (interim, until accounts): the server issues the player id with a secret at `welcome`; `hello` must present both; ids are never broadcast; an id cannot change on a live connection.
- MP-3: campaign `PUT`/`DELETE` refused without the owner's secret (interim) and CORS removed for them; escape every name the board writes as HTML (`panels.js`, `input.js`, the game-over card).
- MP-7: room lifecycle fixes (rematch or close, failed start back to setup, idle rooms closed).
- MP-8: `Origin` check; per-connection rate limits (chat, intents, create/join); a refused intent sends a short refusal, with a full resync at most once a second.
- Tests: `servertest.js` for each (bad URL, spoofed hello, bad origin, floods, a room played twice).

### Phase 1 — database and accounts
- `server/db.js` (open, migrate, queries), data dir from `DATA_DIR` (and the old `CAMPAIGNS_DIR`).
- `server/auth.js`: register, login, logout, me, password change, sessions, rate limits; `server/admin.js`: create user, reset password, list users, make admin, back up the database.
- The lobby and rooms use the session's user; the client gains a sign-in / register screen, and the menu shows who is signed in.
- Tests: unit tests on an in-memory database (migrations, hashing, sessions, expiry, rate limits); `servertest.js` (register, log in, socket refused without a session, two users play a battle).

### Phase 2 — stored battles
- Seeded server dice per game; game rows and the intent log; rebuild on restart; "My games"; resume from another device; forfeits.
- Tests: start a battle, play some turns, restart the server, both players reconnect and the battle continues to the same result as an unbroken one; abandon records a forfeit.

### Phase 3 — campaigns on the server, then online campaigns

Split in three:
- **3a — campaigns in the database (decision 7).** A `campaigns` table (owner, kind solo / hotseat / online, the campaign, a version). A signed-in player's campaigns are saved there, whole, with the version they were read at: a stale save is refused and the newer one handed back (409), so two devices never quietly overwrite each other. The browser's copy stays as a cache, and is all there is for someone not signed in. The old JSON files can be imported by their key's holder (or the admin tool); their routes become read-only.
- **3b — the online loop**, as below: two members, a company each, commands checked by the server, the contract, the picks, the battle from the contract, the aftermath applied once, each player's questions.
- **3c — the dossier online**, and the tests across two browsers.

The original outline:
- Tables for campaigns, members, companies, contracts and reports; the command API on the socket (`camp.*` messages) using the campaign rules; versioned company writes.
- The dossier gains an online mode: the campaign list (mine), invite and join, each player's own dossier, the contract questions and force pick on each device, the battle from the contract, each player's aftermath.
- Import of an existing campaign; the old `/campaign` JSON routes retired (or read-only for import).
- Tests: two users found an online campaign, each manages their company, call a contract, pick, fight (auto-played), see their own aftermath, and the turn moves on; a stale write is refused; the aftermath is applied once.

### Phase 4 — hidden information
- Per-seat snapshots and events; watcher view; the secret swap round, hidden forces before both are ready, the secret mine.
- Tests: a player's socket never receives the other side's secrets.

### Phase 5 — operations
- Deploy: Node 22, `DATA_DIR`, database backups (a nightly copy with `VACUUM INTO`), the admin tool on the Pi, logs.
- `SERVER.md` and the Pi README brought up to date; the startup log fixed.
- Browser tests: sign in on two browsers, an online battle with a restart part-way, an online campaign loop.

## 5. Decisions for the owner

**Settled (all):** 1 — `better-sqlite3`. 2 — guests may play one-off battles; campaigns need an account. 3 — registration open to anyone who can reach the server. 4 — each side's secrets hidden online. 5 — abandoning is a forfeit. 6 — campaigns asynchronous between battles. 7 — the server keeps every campaign of a signed-in player, solo and hotseat too (the browser's copy stays as a cache and for anyone not signed in).

1. **Database:** SQLite through the built-in `node:sqlite` (no dependency; Node 22.5+, still marked experimental), or `better-sqlite3` (one dependency, stable), or a server database such as PostgreSQL (more to run on a Pi)?
2. **Accounts:** must everyone register, or may one-off battles be played as a guest?
3. **Registration:** open to anyone who can reach the server, or by invitation (an admin creates accounts, or an invite code)?
4. **Hidden information online:** hide each side's secrets (forces before both are ready, swaps, the mine), or keep everything visible as now?
5. **Abandoning a battle:** a forfeit (the other side wins, and in a campaign the aftermath is applied), or no result?
6. **Campaign pace:** between battles each player acts whenever they like (asynchronous), with only the battle itself needing both online — or both online for the whole turn?
7. **The other campaign stores** (the browser's own copy and the artifact database): keep them for solo and hotseat, and use the server only for online campaigns?

## 6. Progress

| Item | Outcome | Where |
|---|---|---|
| MP-1 | **Fixed.** A malformed percent-escape is refused (400, or 403 for a file); a request that throws is answered 500 and logged; anything uncaught is logged and the server carries on; SIGTERM/SIGINT close it cleanly. | `server/app.js`, `server/static.js`, `server.js` |
| MP-2 (interim) | **Fixed.** The server issues a private id and a secret at the first `hello`; a returning browser presents both (compared in constant time). Rooms, presence messages and kicks use a separate public id. A second `hello` on a connection changes only the name. | `server/lobby.js`, `src/net/net.js` |
| MP-3 (interim) | **Fixed, differently.** Rather than removing CORS (the game opened from files still saves to a server), a campaign's first save is given a key, kept hashed beside it, and every later save or delete must send it (`x-campaign-key`), so another site's page cannot write. Writes are atomic (a temporary file renamed over). The board's names were already escaped (HB-13); one more, a unit's name on its "aboard" chip, now is. | `server/campaigns.js`, `server/app.js`, `src/view/dossier.js`, `src/view/panels.js` |
| MP-7 | **Fixed.** A finished battle puts the room back in setup with both forces kept, for a rematch; a battle that cannot be laid out goes back to setup with the reason; a room nobody is connected to is closed after 10 minutes (a battle after 6 hours, until phase 2 stores battles). | `server/lobby.js` |
| MP-8 | **Fixed.** The socket's `Origin` must be this server's own (its Host, a proxy's `X-Forwarded-Host`, or `ALLOWED_ORIGINS`); per-connection limits (40 messages a second, 8 chat lines in 10 seconds, 12 rooms a minute) drop and report the excess and close a connection that keeps on; a refused intent resends the whole table at most once a second. | `server/ws.js`, `server/lobby.js`, `server/table.js`, `server.js` |
| Phase 0 tests | `servertest.js`: a bad URL, campaign keys, a rematch, private ids never shown, spoofed hellos, a foreign origin, chat and message floods, an idle room closed. `netplay.js` brings a browser back with its own id and secret. | `test/unit/servertest.js`, `test/browser/netplay.js` |
| Phase 1 — database | **Done.** `server/db.js`: one SQLite file through `better-sqlite3` (decision 1), WAL, numbered migrations kept in `user_version`; every query in one place. The folder is `DATA_DIR`, or beside `CAMPAIGNS_DIR` where only that is set (so an existing Pi install keeps working), or `data/` (neither committed nor served). | `server/db.js`, `server.js` |
| Phase 1 — accounts | **Done.** Open registration (decision 3): a name and a password, scrypt with a salt; sessions a random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` behind TLS), stored only as a hash, 30 days renewed on use; changing a password signs the other devices out. Guests (decision 2): a named session with no account, refused an account's name. Wrong tries limited per name and per address (only failures count); accounts and guests made limited per address. `/api/register`, `/login`, `/guest`, `/logout`, `/password`, `/me` (same origin only). `server/admin.js`: users, create, reset-password, admin, backup. | `server/auth.js`, `server/app.js`, `server/admin.js` |
| Phase 1 — the socket | **Done.** Opened only with a session (401 otherwise); the lobby's identity for a connection is the session's, whatever its `hello` says; rooms show public ids. (The interim id-and-secret of phase 0 is kept only for a lobby run without accounts, as in tests.) | `server/ws.js`, `server/lobby.js`, `server.js` |
| Phase 1 — the screen | **Done.** Multiplayer asks the server who this browser is; not signed in, it offers Sign in, New account, or Play as a guest, then the lobby, which says who is playing and offers Sign out. A lapsed session goes back to the sign-in; a server restarting does not sign anyone out. | `src/net/lobby.js` |
| Phase 1 — deploy | **Done.** The Pi deploy installs the server's packages (`npm ci --omit=dev`); `setup.sh` adds the build tools and `DATA_DIR`; CI installs from the lock file. Node 22+: better-sqlite3 12 has no ready-made build for Node 20 on a Pi, and building it there brought a Pi 3 down; the deploy installs the packages again only when the lock file or Node changes. | `.github/workflows/pi.yml`, `.github/workflows/test.yml`, `deploy/pi/` |
| Phase 1 — tests | `test/unit/auth.js` (in memory: migrations, hashing, sessions renewed and expired, guests, password change and reset, limits, the cookie); `servertest.js` played over signed-in sockets, plus refused sockets (none, made-up), identity from the session, the HTTP routes and an off-site sign-in refused; `netplay.js` (one signs up, the other a guest, the session kept across a closed browser), `nettakeover.js`, `subpath.js` through the sign-in screen. | `test/` |
| Phase 2 — stored battles | **Done.** Each battle rolls its own seeded dice; its config, seed and every intent (refused ones too: a refusal may roll a die) are written as it is played, before anyone is told. A restart brings every battle in progress back, played through again out of sight, the seats held for the players, who walk back in when they reconnect, signed in, from any device. A battle nobody has been at for half an hour is put away (still kept) and comes back when one of its players goes back to it; a new room never takes a kept battle's code. The lobby lists the player's own games — under way (Go back to it) and the last results. Walking away from a battle is a forfeit (decision 5): the other side wins, is told so, and it is kept so. | `server/games.js`, `server/table.js`, `server/lobby.js`, `server/db.js` (migration 2), `src/net/lobby.js` |
| Phase 2 — tests | `serverrestart.js`: a battle played part-way, the server stopped and started again on the same database file, both players back in their seats at the same table (every unit where it was), played on to a result, in both players' lists as won or lost; a battle put away and brought back; a forfeit. `netplay.js`: the player left behind is told they win by forfeit. | `test/unit/serverrestart.js`, `test/browser/netplay.js` |
| Phase 3a — campaigns on the server | **Done.** A signed-in player's campaigns (solo and hotseat) are kept by their account (decision 7): `/api/campaigns` (list, make, read, save, delete; accounts only, never a guest's, never another's), each save over the version it was read at, one from an older copy refused (409) with the newer handed back. The dossier keeps the account's copy alongside the browser's (still the cache, and all there is for anyone not signed in): saves go one at a time; a refused one leaves the newer copy alone and the hub offers "Use that copy" or "Keep this one". An old campaign file is taken into an account with its key (`/api/campaigns/import`). Up to 50 campaigns an account. | `server/db.js` (migration 3), `server/app.js`, `src/view/dossier.js`, `src/view/dossier-hub.js` |
| Phase 3a — tests | `servertest.js`: kept, listed, saved over its version, a stale save refused with the newer copy, not another's to read, not a guest's, an old file imported by its key, deleted. `campaccount.js`: made in one browser, found in another signed in as the same player, a stale save refused and the newer copy taken up. | `test/unit/servertest.js`, `test/browser/campaccount.js` |
| Phase 3b — online campaigns, first part | **Done.** An online campaign is made by a signed-in player (Player 1), with an invite code for Player 2 (`/api/online`, `/api/online/join`). It is kept as a two-player campaign (the hotseat shape, so the rules' two-player paths serve it) marked `online`, with its two members. Each player founds their own force, then changes it only by commands the server runs with the campaign's own rules (`server/campcmds.js`): found, recruit, disband, rename (a unit, a soldier), promote, an honour (three named, one drawn on the server), an upgrade, a mount, a doctrine taken or changed, the force promoted or aspiring, its colours. Each acts on the sender's own force only; a refusal says why; each change is a new version, run one at a time, and the other player is told over their socket. Nothing changes while a battle is being fought. | `server/online.js`, `server/campcmds.js`, `server/db.js` (migration 4), `server/app.js`, `server/lobby.js` |
| Phase 3b — tests | `online.js`: made and joined by code (not by a guest, not by a third), both forces founded under the founding rules, each command on the sender's own force and refused on the other's, money spent and refused, an honour drawn on the server, a colour taken refused, unknown commands and outsiders refused, the other player told, everything held while a battle is fought. | `test/unit/online.js` |
| Phase 3b — the contract and the battle | **Done.** Either player draws up a contract (`contractBegin`): the server rolls the Battle Tier, the levels and the scenario (with Foresighted Command's dice, if either holds it) and the roles. On Our Terms…, Foresighted Command and The Best Defence are asked of the player who holds them; Player 1 sets the Priority Level and the world, as at one screen. Each player picks their force from their own roster (`contractPick`: checked as a legal army, a rebel's tactic, Drug Dealer's few), kept from the other player until both are ready (decision 4); a change to a force sends its pick back. Both ready, the battle is made from the contract at a private table on the server, both seats held for the two players, and both are told its code. When it ends — a forfeit too (decision 5): the engine concedes for the player who walked away — the aftermath is applied by the server once, by the battle's id (a battle that ended just before a restart is applied when it is brought back), the post-battle questions (Plunderer, Tough Negotiators, No Place for the Weak!, a rebirth) answered each by its own player, in turn, and both told. | `server/online.js`, `server/campcmds.js`, `server/lobby.js`, `server/table.js`, `src/engine/engine.js`, `server.js` |
| Phase 3b — tests (contract and battle) | `onlinebattle.js`: a contract drawn up once, the Priority Level Player 1's, picks checked and kept from the other player, a pick sent back by a change to the force, both ready making a private table from the contract with both seats held, a forfeit kept as such in both players' games, the post-battle question put to its own player and refused to the other, the aftermath applied once only, both forces paid, the turn moved on and the dossiers free again. | `test/unit/onlinebattle.js` |
| Phase 3c — the dossier, online | **Done.** Multiplayer → Online campaigns (an account's): the player's online campaigns, a new one (with the code for the second player shown on the hub until they join), or one joined by its code. An online campaign opens in the dossier as the hotseat shape with one side the player's: they found their own force on their own screen, then every change to it (recruiting, disbanding, names, promotions, honours drawn on the server, upgrades, mounts, doctrines, colours) goes to the server as a command, never saved in the browser; the browser's own campaign is put aside meanwhile, untouched. The other player's changes are picked up every few seconds. The contract: drawn up by either, the terms the server's, the holder's doctrines asked of the holder, Player 1 setting the Priority Level, each player's force picked here (“Pick for me”, a rebel's tactic, Drug Dealer's few) and sent when ready; both ready, both are taken into the battle by its code. After it (a forfeit too: the result card, then the campaign), each post-battle question is put to its own player while the other waits, and both read the aftermath once. The menu's account and the lobby lead to it. | `src/view/dossier-online.js`, `src/view/dossier.js` and its kits, `src/net/lobby.js` |
| Phase 3c — tests | `onlinecamp.js`: two browsers — started and joined by code, each force founded on its own screen, the code gone once both are in, a contract with Player 1's pick kept from Player 2, both taken into the battle, a forfeit, Tough Negotiators answered by Player 1 while Player 2 waits, both reading the aftermath, the browser's own campaign back on leaving. | `test/browser/onlinecamp.js` |
| Phase 3c — not yet | Enhanced Genetic Memory's rebirth (a tribe's) is not offered online yet; an online campaign cannot be abandoned or ended from the dossier. | |

