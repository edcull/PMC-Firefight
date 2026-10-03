/* An online campaign's battle (multiplayer plan, phase 3b): the contract drawn up
   by both players, each one's pick kept from the other until both are ready, the
   battle then made from it at a table on the server, and — when it ends, here by
   a forfeit — its aftermath applied once, the post-battle questions put to the
   player each is for, and both players told. */
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
  const told = [];
  let online = null;
  const lobby = new Lobby({
    sweep: false, games: games,
    makeTable: tables.make({ store: games }),
    onCampaignBattle: (id, report, gameId) => online.battleOver(id, report, gameId)
  });
  online = Online.create({
    db: db,
    notify: (uid, msg) => told.push([uid, msg.t, msg.id, msg.code]),
    startBattle: (o) => lobby.campaignBattle(o)
  });
  const ash = (await auth.register('Ash', 'password one', '1', 'ash@example.com')).who;
  const brann = (await auth.register('Brann', 'password two', '1', 'brann@example.com')).who;
  const made = online.make(ash);
  online.join(brann, made.invite);
  const id = made.id;
  const pmc = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
  const reb = ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'];
  online.command(ash, id, 'found', { faction: 'pmc', name: 'Iron Wolves', keys: pmc, doctrine: 'S2', colour: 'ochre' });
  online.command(brann, id, 'found', { faction: 'rebel', name: 'Red Dawn', keys: reb, doctrine: 'H1', colour: 'steel' });
  const camp = (who) => C.rehydrate(online.view(who, id).state);

  console.log('\nThe contract');
  const begun = online.command(brann, id, 'contractBegin', {});
  ok('either player draws up a contract: the Battle Tier, the levels and the scenario rolled on the server', begun.ok && !!camp(ash).online.contract && camp(ash).online.contract.tier >= 1, JSON.stringify(begun).slice(0, 120));
  ok('...once', !online.command(ash, id, 'contractBegin', {}).ok);
  let k = camp(ash).online.contract;
  // Foresighted Command is neither force's, so the scenario is settled
  ok('the scenario is settled, with its roles', !!k.scenario && !(k.fore && !k.fore.done));
  ok('only Player 1 sets the Priority Level', !online.command(brann, id, 'contractLevel', { pl: k.levels[0] }).ok && online.command(ash, id, 'contractLevel', { pl: k.levels[0], planet: 'random' }).ok);
  k = camp(ash).online.contract;
  // a legal force for each side, the largest the rules allow, from the front of the roster
  function legal(co) {
    const rs = co.roster.map((e) => e.rid);
    for (let n = rs.length; n > 0; n--) {
      const units = rs.slice(0, n).map((r) => C.byRid(co, r));
      if (R.checkArmy(units.map((e) => R.entryPick(e)), k.tier, k.pl, co.doctrines, null, co.faction).ok) return rs.slice(0, n);
    }
    return null;
  }
  const aRids = legal(camp(ash).companies.A), bRids = legal(camp(ash).companies.B);
  ok('(a legal force can be picked for each)', !!aRids && !!bRids);
  ok('ready before picking is refused', /pick a force/.test(online.command(ash, id, 'contractReady', {}).why));
  ok('a unit of the other force cannot be picked', !online.command(ash, id, 'contractPick', { rids: bRids }).ok);
  ok('Player 1 picks their force', online.command(ash, id, 'contractPick', { rids: aRids }).ok);
  const seenByB = online.view(brann, id).state.online.contract;
  ok('...which Player 2 does not see (only that it is picked)', seenByB.picks.A && seenByB.picks.A.hidden === true && !seenByB.picks.A.rids);
  ok('...but Player 1 does', online.view(ash, id).state.online.contract.picks.A.rids.length === aRids.length);
  ok('Player 1 is ready', online.command(ash, id, 'contractReady', {}).ok);
  // a change to the force while a contract is out sends the pick back
  online.command(ash, id, 'rename', { rid: aRids[0], name: 'First In' });
  ok('changing the force sends its pick back to be made again', camp(ash).online.contract.picks.A === null && camp(ash).online.contract.ready.A === false);
  online.command(ash, id, 'contractPick', { rids: aRids });
  online.command(ash, id, 'contractReady', {});
  ok('Player 2 picks theirs', online.command(brann, id, 'contractPick', { rids: bRids, tactic: R.TACTICS[0] && R.TACTICS[0].id }).ok);
  const n0 = told.length;
  const go = online.command(brann, id, 'contractReady', {});
  ok('both ready: the battle is made, its code given', go.ok && go.both && /^[A-Z0-9]+$/.test(go.battle || ''), JSON.stringify(go).slice(0, 160));
  ok('...and both players told where it is', told.slice(n0).filter((t) => t[1] === 'camp.battle' && t[3] === go.battle).length === 2);
  const after0 = camp(ash);
  ok('the campaign holds while it is fought', !!after0.pending && after0.online.battle.code === go.battle && /battle is being fought/.test(online.command(ash, id, 'recruit', { key: 'recruits' }).why));
  ok('...both picks shown once both are ready', online.view(brann, id).state.online.contract.picks.A.rids.length === aRids.length);

  console.log('\nThe battle');
  const room = lobby.rooms.get(go.battle);
  ok('a private room, both seats held for the two players', room && room.settings.private && room.settings.onlineCampaign === id && room.seats.A.id === 'u' + ash.userId && room.seats.B.id === 'u' + brann.userId);
  ok('...with a table started from the contract', room && room.table && room.table.cfg.nameA === 'Iron Wolves' && room.table.cfg.armyA.length === aRids.length && room.table.cfg.armyB.length === bRids.length);
  ok('...kept in the database', !!games.byCode(go.battle));
  const kUC0 = { A: after0.companies.A.kUC, B: after0.companies.B.kUC };
  const gameId = room.table.gameId;
  const n1 = told.length;
  room.table.forfeit('B');
  const gA = games.mine('u' + ash.userId)[0], gB = games.mine('u' + brann.userId)[0];
  ok('Player 2 walking away loses it by forfeit, kept so in both players\' games', !games.byCode(go.battle) && gA.status === 'abandoned' && gA.result === 'won by forfeit' && gB.result === 'lost by forfeit', JSON.stringify([gA, gB]));

  console.log('\nAfter it');
  let s = camp(ash);
  ok('the post-battle questions are put: Tough Negotiators to Player 1', s.post && s.post.steps.length === 1 && s.post.steps[0].kind === 'negotiate' && s.post.steps[0].side === 'A', JSON.stringify(s.post && s.post.steps));
  ok('...both players told', told.slice(n1).filter((t) => t[1] === 'camp.changed').length === 2);
  ok('the contract and the battle are cleared', !s.online.contract && !s.online.battle);
  ok('the aftermath is applied once only, by the battle\'s id', online.battleOver(id, s.post.report, gameId) === false);
  ok('Player 2 cannot answer Player 1\'s question', /other player/.test(online.command(brann, id, 'postNext', {}).why));
  ok('...nor may the dossiers be used yet', !online.command(ash, id, 'recruit', { key: 'recruits' }).ok);
  const neg = online.command(ash, id, 'postNegotiate', { sel: [0] });
  ok('Player 1 re-rolls a die for Tough Negotiators', neg.ok && camp(ash).post.pre.neg.A.swapped.length === 1, JSON.stringify(neg).slice(0, 100));
  ok('...once', !online.command(ash, id, 'postNegotiate', { sel: [0] }).ok);
  ok('...and goes on', online.command(ash, id, 'postNext', {}).ok);
  s = camp(ash);
  ok('every question answered: the aftermath is applied', !s.post && !s.pending && s.online.after && s.online.after.winner === 'A', JSON.stringify(s.online.after && s.online.after.winner));
  ok('...each force paid', s.companies.A.kUC > kUC0.A && s.companies.B.kUC >= kUC0.B, JSON.stringify([kUC0, s.companies.A.kUC, s.companies.B.kUC]));
  ok('...the turn moved on, and the dossiers free again', s.turn === after0.turn + 1 && online.command(ash, id, 'colour', { colour: 'olive' }).ok, s.turn + ' / ' + after0.turn);
  ok('the room is closed: an online campaign battle has no rematch', !room.table && !lobby.rooms.has(go.battle));
  ok('the battle\'s aftermath is kept on the campaign\'s log, to be read again', !!(s.log.length && s.log[s.log.length - 1].after && s.log[s.log.length - 1].after.winner === 'A'));
  ok('a new contract may be drawn up', online.command(ash, id, 'contractBegin', {}).ok);

  console.log('\nThe end of it');
  ok('a force that can still fight cannot be said to be finished', /can still field an army/.test(online.command(ash, id, 'campEnd', { side: 'B' }).why));
  const n3 = told.length;
  const gave = online.command(brann, id, 'concede', {});
  const over = camp(ash).over;
  ok('a player gives the campaign up: it is over for both, the other the winner', gave.ok && over && over.loser === 'B' && over.winner === 'A' && /gave the campaign up/.test(over.text) && !camp(ash).online.contract, JSON.stringify(over));
  ok('...the other player told', told.slice(n3).some((t) => t[0] === ash.userId && t[1] === 'camp.changed'));
  ok('...and nothing more is done in it', /campaign is over/.test(online.command(ash, id, 'recruit', { key: 'recruits' }).why) && !online.command(ash, id, 'contractBegin', {}).ok);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
