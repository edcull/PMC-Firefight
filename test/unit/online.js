/* Online campaigns, a world of two to eight forces (server/online.js), on a database
   in memory with a real lobby and tables: the campaign's lobby (slots open, players
   joining, AI forces and their armies, colours, chat, ready, the host starting it);
   each player founding their force; a contract with an AI force taken from the
   offers rolled for them, fought on the server with the AI side played there, and
   its aftermath applied there; two players challenging each other, the contract
   drawn up only once accepted, fought, its aftermath for both; whose move it is;
   and a player stepping out. */
'use strict';
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const Games = require('../../server/games.js');
const Online = require('../../server/online.js');
const tables = require('../../server/table.js');
const { Lobby } = require('../../server/lobby.js');
const { C, R } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const db = DB.open(':memory:');
  const many = { per: 1000, n: 1000 };
  const auth = Auth.create({ db: db, limits: { loginName: many, loginIp: many, register: many, guest: many } });
  const games = Games.create(db);
  const told = [], mailed = [];
  let online = null, listedTold = 0;
  const lobby = new Lobby({
    sweep: false, games: games,
    makeTable: tables.make({ store: games }),
    onCampaignBattle: (id, report, gameId, ref) => online.battleOver(id, report, gameId, ref)
  });
  online = Online.create({
    db: db,
    notify: (uid, msg) => told.push([uid, msg.t, msg.id, msg.code]),
    startBattle: (o) => lobby.campaignBattle(o),
    listedChanged: () => listedTold++,
    mailer: { link: (k, t) => '/?' + k + '=' + t, send: (m) => { mailed.push(m); return Promise.resolve({ ok: true }); } }
  });
  const reg = async (n) => (await auth.register(n, 'password ' + n, '1', n.toLowerCase() + '@example.com')).who;
  const ash = await reg('Ash'), brann = await reg('Brann'), cole = await reg('Cole'), dara = await reg('Dara');
  const guest = auth.guest('Passer', '1').who;
  const cmd = (who, c, a) => online.command(who, id, c, a || {});
  const view = (who) => online.view(who, id);

  console.log('\nThe lobby');
  ok('a guest cannot start one', !online.make(guest).ok);
  const made = online.make(ash, { listed: true });
  const id = made.id;
  let v = view(ash);
  ok('made: in its lobby, the maker the host in the first slot, with a code', made.ok && v.phase === 'lobby' && v.host && v.slots[0].you && /^[A-Z2-9]{8}$/.test(made.invite));
  ok('...four slots to begin with: the host, one open, two AI forces', v.slots.map((s) => s.kind).join() === 'human,open,ai,ai', v.slots.map((s) => s.kind).join());
  ok('a public one is listed for anyone to join, with its open slots', online.listed().some((c) => c.invite === made.invite && c.open === 1 && c.slots === 4));
  ok('the host makes it private: off the list', cmd(ash, 'lobbyListed', { on: false }).ok && !online.listed().some((c) => c.invite === made.invite) && !view(ash).listed);
  ok('...and public again', cmd(ash, 'lobbyListed', { on: true }).ok && online.listed().some((c) => c.invite === made.invite) && view(ash).listed);
  ok('only the host sets the slots', !cmd(brann, 'lobbySlots', { n: 6 }).ok && !cmd(brann, 'lobbyListed', { on: false }).ok);
  ok('the host makes it six', cmd(ash, 'lobbySlots', { n: 6 }).ok && view(ash).slots.length === 6);
  ok('...always an even number, up to ten', cmd(ash, 'lobbySlots', { n: 11 }).ok && view(ash).slots.length === 10 && cmd(ash, 'lobbySlots', { n: 6 }).ok && view(ash).slots.length === 6);
  ok('...the new ones open', view(ash).slots.slice(4).every((s) => s.kind === 'open'));
  const j1 = online.join(brann, made.invite);
  ok('a player joins with the code: the first open slot', j1.ok && j1.slot === 1 && view(brann).slots[1].you && view(brann).slots[1].name === 'Brann');
  ok('...and the others are told', told.some((t) => t[0] === ash.userId && t[1] === 'camp.changed' && t[2] === id));
  ok('joining again is no harm', online.join(brann, made.invite).slot === 1);
  ok('a joined player cannot change the slots', !cmd(brann, 'lobbySlot', { i: 4, kind: 'ai' }).ok);
  ok('the host sets an open slot to an AI force', cmd(ash, 'lobbySlot', { i: 4, kind: 'ai' }).ok && view(ash).slots[4].kind === 'ai');
  ok('...and picks its army', cmd(ash, 'lobbyFaction', { i: 4, faction: 'bugs' }).ok && view(ash).slots[4].faction === 'bugs');
  ok('a player picks their own army', cmd(brann, 'lobbyFaction', { i: 1, faction: 'rebel' }).ok && view(ash).slots[1].faction === 'rebel');
  ok('...but not another’s', !cmd(brann, 'lobbyFaction', { i: 2, faction: 'xeno' }).ok);
  ok('a colour for each slot: a player their own', cmd(brann, 'lobbyColour', { i: 1, colour: 'cobalt' }).ok && view(ash).slots[1].colour === 'cobalt');
  ok('...never one another player wears', /another player wears that colour/.test(cmd(ash, 'lobbyColour', { i: 0, colour: 'cobalt' }).why));
  ok('the host colours an AI force', cmd(ash, 'lobbyColour', { i: 2, colour: 'lime' }).ok);
  ok('a player takes the colour an AI force wears: the AI force takes another at random', cmd(brann, 'lobbyColour', { i: 1, colour: 'lime' }).ok &&
    view(ash).slots[1].colour === 'lime' && view(ash).slots[2].colour && view(ash).slots[2].colour !== 'lime');
  cmd(brann, 'lobbyColour', { i: 1, colour: 'cobalt' }); cmd(ash, 'lobbyColour', { i: 2, colour: 'lime' });
  ok('the chat', cmd(brann, 'lobbyChat', { text: 'hello all' }).ok && view(ash).chat.some((c) => c.from === 'Brann' && c.text === 'hello all'));
  online.join(cole, made.invite);
  ok('a third takes the next open slot', view(cole).slot === 5);
  ok('it cannot start with a player not ready', /not ready/.test(cmd(ash, 'lobbyStart').why));
  ok('a player leaves: the slot opens again', online.leave(cole, id).ok && view(ash).slots[5].kind === 'open');
  ok('...and it cannot start with an open slot', /every slot needs/.test(cmd(ash, 'lobbyStart').why));
  online.join(cole, made.invite);
  cmd(brann, 'lobbyReady', {}); cmd(cole, 'lobbyReady', {});
  ok('a change to the slots asks the players to say they are ready again', cmd(ash, 'lobbySlots', { n: 6 }).ok && !view(ash).slots[1].ready);
  cmd(brann, 'lobbyReady', {}); cmd(cole, 'lobbyReady', {});
  ok('only the host starts it', !cmd(brann, 'lobbyStart').ok);
  ok('...and not before saying they are ready too', /Ash is not ready/.test(cmd(ash, 'lobbyStart').why));
  cmd(ash, 'lobbyReady', {});
  const st = cmd(ash, 'lobbyStart');
  v = view(ash);
  ok('everyone ready: the host starts it', st.ok && v.phase === 'run', JSON.stringify(st).slice(0, 120));
  ok('...no longer listed', !online.listed().some((c) => c.invite === made.invite));
  ok('...nobody joins once it is under way', /under way/.test(online.join(dara, made.invite).why));

  console.log('\nThe world');
  const camp = (who) => view(who).state;
  let s = camp(ash);
  ok('the AI forces are raised, each with its own name and dossier', s.rivals.filter((r) => !r.human).length === 3 && s.rivals.filter((r) => !r.human).every((r) => r.roster.length && r.name !== 'Rival'), s.rivals.map((r) => r.name).join(', '));
  ok('...in their armies and colours as asked', s.rivals.filter((r) => !r.human).some((r) => r.faction === 'bugs') && s.rivals.some((r) => r.colour === 'lime'));
  ok('the other players are on it too, shown as rivals are', s.rivals.filter((r) => r.human).map((r) => r.player).sort().join() === 'Brann,Cole');
  ok('each player’s own force is theirs to found', !s.companies.A.roster.length && view(ash).waiting === 'you');
  const pmc = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
  const reb = ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'];
  ok('nothing else before founding', /found the force first/.test(cmd(ash, 'recruit', { key: 'recruits' }).why));
  ok('Ash founds theirs', cmd(ash, 'found', { faction: 'pmc', name: 'Iron Wolves', keys: pmc, doctrine: 'S2' }).ok);
  ok('...in the colour of their slot', camp(ash).companies.A.colour === 'ochre');
  ok('a name another force has is refused', /called that/.test(cmd(brann, 'found', { faction: 'rebel', name: 'iron wolves', keys: reb, doctrine: 'H1' }).why));
  ok('Brann founds theirs', cmd(brann, 'found', { faction: 'rebel', name: 'Red Dawn', keys: reb, doctrine: 'H1' }).ok);
  cmd(cole, 'found', { faction: 'pmc', name: 'Grey Lancers', keys: pmc, doctrine: 'S1' });
  s = camp(ash);
  ok('founded, the contracts against the AI forces are on offer, rolled for them', (s.offers || []).length >= 1 && s.offersTurn === s.turn && s.offers.every((o) => o.rival < 3), JSON.stringify((s.offers || []).map((o) => o.rival)));
  ok('...the same ones each time they look (kept for the turn)', JSON.stringify(camp(ash).offers) === JSON.stringify(s.offers));
  ok('free to take one or challenge someone: “either”', view(ash).waiting === 'either');

  console.log('\nA contract with an AI force');
  const off = s.offers[0], aiName = s.rivals[off.rival].name;
  ok('Ash takes one', cmd(ash, 'aiTake', { i: 0 }).ok);
  let k = camp(ash).online.contract;
  ok('...its terms as offered: the enemy, the scenario, the Tier', k && k.scenario.id === off.scenario.id && k.tier === off.tier && camp(ash).companies.B.name === aiName);
  ok('...nothing else may be taken meanwhile', /under way/.test(cmd(ash, 'aiTake', { i: 0 }).why));
  function legal(co, kk) {
    const rs = co.roster.map((e) => e.rid);
    for (let n = rs.length; n > 0; n--) {
      const units = rs.slice(0, n).map((r) => C.byRid(co, r));
      if (R.checkArmy(units.map((e) => R.entryPick(e)), kk.tier, kk.pl, co.doctrines, null, co.faction).ok) return rs.slice(0, n);
    }
    return null;
  }
  // the Foresighted Command dice, if either holds it, are set aside first
  while (k.fore && !k.fore.done) { const left = [0, 1, 2].filter((x) => k.fore.ignored.indexOf(x) < 0); cmd(ash, 'aiForego', { i: left[0] }); k = camp(ash).online.contract; }
  const aR = legal(camp(ash).companies.A, k);
  ok('ready before picking is refused', /pick a force/.test(cmd(ash, 'aiReady').why));
  ok('Ash picks a force', cmd(ash, 'aiPick', { rids: aR }).ok);
  const n0 = told.length;
  const go = cmd(ash, 'aiReady');
  ok('ready: the battle is made on the server, its code given', go.ok && /^[A-Z0-9]+$/.test(go.battle || ''), JSON.stringify(go).slice(0, 120));
  ok('...and the player told where it is', told.slice(n0).some((t) => t[0] === ash.userId && t[1] === 'camp.battle' && t[3] === go.battle));
  const room = lobby.rooms.get(go.battle);
  ok('a private room: the player’s seat held, the AI’s side with nobody in it', room && room.settings.private && room.seats.A.id === 'u' + ash.userId && !room.seats.B);
  ok('...the table set for the AI to play side B, against the AI force’s own list', room && room.table.cfg.mode === 'ai' && room.table.cfg.nameB === aiName && room.table.cfg.armyB.length > 0 && room.table.engine.state().cfg.aiSides.indexOf('B') >= 0);
  ok('the force holds while it is fought', /battle is being fought/.test(cmd(ash, 'recruit', { key: 'recruits' }).why));
  ok('...but the others play on meanwhile (Brann takes a contract of their own)', (() => {
    const bo = camp(brann).offers, busy = camp(brann).online.busyAi;
    const at = bo.findIndex((o) => busy.indexOf(o.rival) < 0);
    return at >= 0 && cmd(brann, 'aiTake', { i: at }).ok;
  })());
  ok('...an AI force already fighting is not taken by another', (() => {
    const bo = camp(cole).offers, at = bo.findIndex((o) => camp(cole).rivals[o.rival].name === aiName);
    return at < 0 || /fighting someone else/.test(cmd(cole, 'aiTake', { i: at }).why);
  })());
  cmd(brann, 'aiDrop');
  ok('a contract not yet fought may be dropped', !camp(brann).online.contract);
  const before = camp(ash), kUC0 = before.companies.A.kUC, gameId = room.table.gameId;
  room.table.forfeit('B');
  s = camp(ash);
  ok('the AI force is beaten (here, by forfeit): Tough Negotiators is put to Ash', s.post && s.post.steps.length === 1 && s.post.steps[0].kind === 'negotiate', JSON.stringify(s.post && s.post.steps));
  ok('...applied once only, by the battle’s id', online.battleOver(id, s.post.report, gameId, { kind: 'ai', slot: 0 }) === false);
  ok('Ash goes on', cmd(ash, 'postNext').ok);
  s = camp(ash);
  ok('every question answered: the aftermath is applied, paid, the turn moved on', !s.post && !s.pending && s.online.after && s.online.after.winner === 'A' && s.companies.A.kUC > kUC0 && s.turn === before.turn + 1, JSON.stringify(s.online.after && s.online.after.winner));
  ok('...the AI force grew from it, as a rival does', s.online.after.rival !== undefined);
  ok('...the AI forces not in it go off to fight each other elsewhere, played out on the server', s.online.after.frontsLeft >= 1 && !(s.online.after.elsewhere || []).length, 'fronts left: ' + s.online.after.frontsLeft);
  ok('...and are not offered to anyone meanwhile', camp(cole).online.busyAi.length >= 2, JSON.stringify(camp(cole).online.busyAi));
  const t0 = Date.now();
  await online.idle();
  s = camp(ash);
  const els = s.online.after.elsewhere || [];
  ok('...each battle fought out in full, the AI on both sides, and settled as a battle is', els.length >= 2 && els.every((x) => x.battle && x.battle.turns >= 1) && s.online.after.frontsLeft === 0,
    JSON.stringify(els.map((x) => [x.name, x.result, x.battle && x.battle.turns])) + ' in ' + (Date.now() - t0) + 'ms');
  ok('...its report added to the aftermath kept on the log', (s.log[0].after.elsewhere || []).length === els.length);
  ok('...and the forces free again', camp(cole).online.busyAi.length === 0);
  ok('...kept on the log, to be read again', s.log.length === 1 && s.log[0].after && s.log[0].against === aiName);
  ok('...and fresh offers for the new turn', s.offersTurn === s.turn && s.offers.length >= 1);
  ok('the room is closed', !lobby.rooms.has(go.battle));

  console.log('\nA duel between two players');
  ok('Ash challenges Brann', cmd(ash, 'duelAsk', { to: 1 }).ok);
  const ch = camp(brann).online.challenges[0];
  ok('...Brann sees the challenge; nothing is drawn up yet', ch && !ch.mine && ch.from === 0 && !camp(brann).online.duel && view(brann).waiting === 'you');
  ok('...not twice', !cmd(ash, 'duelAsk', { to: 1 }).ok);
  ok('Brann accepts: the contract is drawn up now, between them', cmd(brann, 'duelAccept', { id: ch.id }).ok && !!camp(brann).online.duel.contract);
  const da = camp(ash).online.duel, db2 = camp(brann).online.duel;
  ok('...each on their own side of it', da.side === 'A' && db2.side === 'B' && da.foeName === 'Red Dawn' && db2.foeName === 'Iron Wolves');
  ok('...and neither may take another contract meanwhile', /under way/.test(cmd(ash, 'aiTake', { i: 0 }).why));
  let dk = camp(ash).online.duel.contract;
  while (dk.fore && !dk.fore.done) {
    const who = dk.fore.order[dk.fore.ignored.length] === 'A' ? ash : brann;
    const left = [0, 1, 2].filter((x) => dk.fore.ignored.indexOf(x) < 0);
    cmd(who, 'duel', { cmd: 'contractForego', args: { i: left[0] } });
    dk = camp(ash).online.duel.contract;
  }
  // the Priority Level: the highest both can field to begin with; it changes only when both want the same
  ok('the Priority Level starts at the highest both forces can field', dk.pl === Math.max.apply(null, dk.levels), JSON.stringify(dk.levels) + ' ' + dk.pl);
  if (dk.levels.length > 1) {
    const other = dk.levels.filter((n) => n !== dk.pl)[0];
    cmd(brann, 'duel', { cmd: 'contractLevel', args: { pl: other } });
    ok('...one player asking for another does not change it', camp(ash).online.duel.contract.pl === dk.pl && camp(ash).online.duel.contract.plWant.B === other);
    cmd(ash, 'duel', { cmd: 'contractLevel', args: { pl: other } });
    ok('...both asking for it does', camp(ash).online.duel.contract.pl === other);
    cmd(ash, 'duel', { cmd: 'contractLevel', args: { pl: dk.pl } }); cmd(brann, 'duel', { cmd: 'contractLevel', args: { pl: dk.pl } });
    dk = camp(ash).online.duel.contract;
  }
  ok('...a level neither can field is not on offer', !cmd(ash, 'duel', { cmd: 'contractLevel', args: { pl: 3 } }).ok);
  const dA = legal(camp(ash).companies.A, dk), dB = legal(camp(brann).companies.A, dk);
  ok('Ash picks', cmd(ash, 'duel', { cmd: 'contractPick', args: { rids: dA } }).ok);
  ok('...unseen by Brann until both are ready', camp(brann).online.duel.contract.picks.A.hidden === true);
  cmd(ash, 'duel', { cmd: 'contractReady', args: {} });
  ok('Brann picks', cmd(brann, 'duel', { cmd: 'contractPick', args: { rids: dB } }).ok);
  const n1 = told.length;
  const dgo = cmd(brann, 'duel', { cmd: 'contractReady', args: {} });
  ok('both ready: the battle is made, both told where it is', dgo.ok && dgo.battle && told.slice(n1).filter((t) => t[1] === 'camp.battle' && t[3] === dgo.battle).length === 2, JSON.stringify(dgo).slice(0, 100));
  const droom = lobby.rooms.get(dgo.battle);
  ok('...both seats held for the two players', droom && droom.seats.A.id === 'u' + ash.userId && droom.seats.B.id === 'u' + brann.userId && droom.table.cfg.mode === 'hotseat');
  ok('Cole fights an AI force meanwhile: battles side by side', (() => {
    const co = camp(cole), at = co.offers.findIndex((o) => co.online.busyAi.indexOf(o.rival) < 0);
    if (at < 0 || !cmd(cole, 'aiTake', { i: at }).ok) return false;
    let kc = camp(cole).online.contract;
    while (kc.fore && !kc.fore.done) { const left = [0, 1, 2].filter((x) => kc.fore.ignored.indexOf(x) < 0); cmd(cole, 'aiForego', { i: left[0] }); kc = camp(cole).online.contract; }
    cmd(cole, 'aiPick', { rids: legal(camp(cole).companies.A, kc) });
    const g = cmd(cole, 'aiReady');
    return g.ok && lobby.rooms.has(g.battle) && lobby.rooms.has(dgo.battle);
  })());
  const kA = camp(ash).companies.A.kUC, kB = camp(brann).companies.A.kUC, tA = camp(ash).turn, tB = camp(brann).turn;
  droom.table.forfeit('A');
  s = camp(ash);
  const sb = camp(brann);
  ok('Ash walks away: Brann wins it; Ash’s question (Tough Negotiators) first', s.post && s.post.steps[0].side === 'A' && /other player/.test(cmd(brann, 'postNext').why));
  cmd(ash, 'postNegotiate', { sel: [0] });
  ok('Ash answers', cmd(ash, 'postNext').ok);
  s = camp(ash);
  const s2 = camp(brann);
  ok('the aftermath for both: each paid, each turn on by one', s.companies.A.kUC > kA && s2.companies.A.kUC > kB && s.turn === tA + 1 && s2.turn === tB + 1, [kA, s.companies.A.kUC, kB, s2.companies.A.kUC].join());
  ok('...each reads it as their own (Brann won theirs, Ash lost theirs)', s2.online.after.winner === 'A' && s.online.after.winner === 'B');
  ok('...on each player’s log, against the other', s.log[s.log.length - 1].against === 'Red Dawn' && s2.log[s2.log.length - 1].against === 'Iron Wolves');
  ok('...and the duel is over: both free again', !s.online.duel && !s2.online.duel && view(ash).waiting === 'either');
  void sb;

  console.log('\nWhose move, and stepping out');
  mailed.length = 0;
  db.setNotify(brann.userId, true);
  ok('a challenge is “your move” for the one challenged, by email if they asked', cmd(ash, 'duelAsk', { to: 1 }).ok && view(brann).waiting === 'you' && mailed.some((m) => m.to === 'brann@example.com' && /Your move/.test(m.subject)));
  const ch2 = camp(brann).online.challenges[0];
  ok('a challenge may be turned down', cmd(brann, 'duelCancel', { id: ch2.id }).ok && !camp(ash).online.challenges.length);
  ok('the list shows each campaign, its phase and whose move', online.list(ash).some((c) => c.id === id && c.phase === 'run' && c.forces === 6 && c.waiting === 'either'));
  ok('a force that can still fight cannot be said to be finished', /can still field an army/.test(cmd(cole, 'campEnd').why));
  ok('a player gives it up: out of the world', cmd(brann, 'concede').ok && view(brann).slots[1].out && view(brann).waiting === null);
  ok('...and does no more in it', /out of this campaign/.test(cmd(brann, 'recruit', { key: 'rciv' }).why));
  ok('...while the others play on', view(ash).phase === 'run' && cmd(ash, 'colour', { colour: 'olive' }).ok);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
