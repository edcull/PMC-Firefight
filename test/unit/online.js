/* Online campaigns (multiplayer plan, phase 3b), on a database in memory: one made
   and joined with its code, each player founding their own force, the commands the
   server runs on each player's own company (and refuses on the other's), a die for
   an honour drawn on the server, each change kept as a new version, and the other
   player told. */
'use strict';
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const Online = require('../../server/online.js');
const { C } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const db = DB.open(':memory:');
  const many = { per: 1000, n: 1000 };
  const auth = Auth.create({ db: db, limits: { loginName: many, loginIp: many, register: many, guest: many } });
  const told = [];
  const online = Online.create({ db: db, notify: (uid, msg) => told.push([uid, msg.t, msg.id]) });
  const ash = (await auth.register('Ash', 'password one', '1', 'ash@example.com')).who;
  const brann = (await auth.register('Brann', 'password two', '1', 'brann@example.com')).who;
  const cole = (await auth.register('Cole', 'password three', '1', 'cole@example.com')).who;
  const guest = auth.guest('Passer', '1').who;

  console.log('\nMade, and joined with its code');
  const made = online.make(ash);
  ok('a player makes an online campaign: Player 1, with a code for Player 2', made.ok && made.side === 'A' && /^[A-Z2-9]{8}$/.test(made.invite));
  ok('...not a guest', !online.make(guest).ok);
  const v0 = online.view(ash, made.id);
  ok('its maker sees it, the code shown while the seat is open', v0.ok && v0.side === 'A' && v0.invite === made.invite && v0.players.length === 1);
  ok('nobody else sees it', online.view(brann, made.id).code === 404);
  ok('a wrong code finds nothing', online.join(brann, 'NOPENOPE').code === 404);
  const j = online.join(brann, made.invite.toLowerCase());
  ok('the second player joins with the code (in any case) as Player 2', j.ok && j.side === 'B');
  ok('...and Player 1 is told', told.some((t) => t[0] === ash.userId && t[1] === 'camp.changed' && t[2] === made.id));
  ok('a third may not join', online.join(cole, made.invite).code === 409);
  ok('joining again is no harm', online.join(brann, made.invite).side === 'B');
  ok('the code is no longer shown once both are in', online.view(ash, made.id).invite === null);
  ok('both see it in their list', online.list(ash).some((c) => c.id === made.id && c.side === 'A') && online.list(brann).some((c) => c.id === made.id && c.side === 'B'));

  console.log('\nEach founds their own force');
  const pmc = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
  const reb = ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'];
  ok('nothing else may be done before founding', online.command(ash, made.id, 'recruit', { key: 'recruits' }).why === 'found the force first');
  const badFound = online.command(ash, made.id, 'found', { faction: 'pmc', name: 'Iron Wolves', keys: pmc.slice(0, 3), doctrine: 'S2' });
  ok('a founding that breaks the rules is refused, and says why', !badFound.ok && /Tier I units/.test(badFound.why), badFound.why);
  const fa = online.command(ash, made.id, 'found', { faction: 'pmc', name: 'Iron Wolves', keys: pmc, doctrine: 'S2', colour: 'ochre' });
  ok('Player 1 founds theirs', fa.ok && fa.version === 3, JSON.stringify(fa).slice(0, 120));
  ok('...once only', !online.command(ash, made.id, 'found', { faction: 'pmc', name: 'Again', keys: pmc, doctrine: 'S2' }).ok);
  ok('Player 2 may not wear Player 1\'s colour, nor their name', !online.command(brann, made.id, 'found', { faction: 'rebel', name: 'Red Dawn', keys: reb, doctrine: 'H1', colour: 'ochre' }).ok &&
    !online.command(brann, made.id, 'found', { faction: 'rebel', name: 'iron wolves', keys: reb, doctrine: 'H1', colour: 'steel' }).ok);
  ok('...nor found from another force\'s list', !online.command(brann, made.id, 'found', { faction: 'rebel', name: 'Red Dawn', keys: pmc, doctrine: 'H1', colour: 'steel' }).ok);
  const fb = online.command(brann, made.id, 'found', { faction: 'rebel', name: 'Red Dawn', keys: reb, doctrine: 'H1', colour: 'steel' });
  ok('Player 2 founds theirs', fb.ok);
  const st = C.rehydrate(online.view(ash, made.id).state);
  ok('the campaign holds both forces, each the player\'s own', st.companies.A.name === 'Iron Wolves' && st.companies.B.name === 'Red Dawn' && st.companies.B.faction === 'rebel' && st.mode === 'hotseat' && !!st.online);
  ok('...and is listed under both names', online.list(brann)[0].name === 'Iron Wolves v Red Dawn', online.list(brann)[0].name);

  console.log('\nThe commands');
  const aDos = () => C.rehydrate(online.view(ash, made.id).state).companies.A;
  const bDos = () => C.rehydrate(online.view(ash, made.id).state).companies.B;
  // a little money, as a battle would have paid: set on the kept campaign, as the aftermath will
  const row = db.campaign(made.id); const s0 = C.rehydrate(row.state); s0.companies.A.kUC = 20;
  db.saveOnline({ id: made.id, version: row.version, state: C.forSave(s0), name: 'Iron Wolves v Red Dawn', turn: 0, at: Date.now() });
  const rec = online.command(ash, made.id, 'recruit', { key: 'recruits' });
  ok('recruiting spends the force\'s own money', rec.ok && aDos().kUC === 20 - rec.cost && aDos().roster.length === 10, JSON.stringify({ ok: rec.ok, why: rec.why, cost: rec.cost }));
  const poor = online.command(brann, made.id, 'recruit', { key: 'rlmg' });
  ok('...and is refused with none', !poor.ok && /has 0/.test(poor.why), poor.why);
  const aUnit = aDos().roster[aDos().roster.length - 1], bUnit = bDos().roster[1];
  ok('a unit is renamed by its own player', online.command(ash, made.id, 'rename', { rid: aUnit.rid, name: 'The Lucky Few' }).ok && aDos().roster.slice(-1)[0].name === 'The Lucky Few');
  ok('...never the other player\'s', !online.command(ash, made.id, 'rename', { rid: bUnit.rid, name: 'Mine now' }).ok && bDos().roster[1].name !== 'Mine now');
  ok('disbanding is the force\'s own, and keeps it legal', online.command(ash, made.id, 'disband', { rid: aUnit.rid }).ok && !online.command(brann, made.id, 'disband', { rid: bDos().cmdRid }).ok);
  // an honour: three named, one drawn on the server
  const r2 = db.campaign(made.id), s2 = C.rehydrate(r2.state);
  const vet = s2.companies.B.roster[1]; vet.exp = 40;
  db.saveOnline({ id: made.id, version: r2.version, state: C.forSave(s2), name: 'Iron Wolves v Red Dawn', turn: 0, at: Date.now() });
  const open = C.availableHonours(C.rehydrate(db.campaign(made.id).state).companies.B.roster[1]).map((h) => h.n);
  ok('two honours named is not enough', !online.command(brann, made.id, 'honour', { rid: vet.rid, picks: open.slice(0, 2) }).ok);
  const h = online.command(brann, made.id, 'honour', { rid: vet.rid, picks: open.slice(0, 3) });
  ok('three named, one is drawn among them by the server, and the EXP spent', h.ok && open.slice(0, 3).indexOf(h.won) >= 0 && bDos().roster[1].honours.indexOf(h.won) >= 0 && bDos().roster[1].exp < 40, JSON.stringify(h).slice(0, 100));
  ok('a colour the other force wears is refused', !online.command(brann, made.id, 'colour', { colour: 'ochre' }).ok && online.command(brann, made.id, 'colour', { colour: 'olive' }).ok);
  ok('an unknown command is refused', online.command(ash, made.id, 'giveMeMoney', {}).why === 'no such command');
  ok('nobody outside the campaign may send one', online.command(cole, made.id, 'recruit', { key: 'recruits' }).code === 404);
  const n0 = told.length;
  online.command(brann, made.id, 'colour', { colour: 'steel' });
  ok('each change is kept as a new version, and the other player told', told.length === n0 + 1 && told[n0][0] === ash.userId && online.view(ash, made.id).version > fb.version);
  // a battle being fought holds everything
  const r3 = db.campaign(made.id), s3 = C.rehydrate(r3.state); s3.pending = { turn: 1 };
  db.saveOnline({ id: made.id, version: r3.version, state: C.forSave(s3), name: 'x', turn: 0, at: Date.now() });
  ok('while a battle is being fought, the dossiers wait', /battle is being fought/.test(online.command(ash, made.id, 'recruit', { key: 'recruits' }).why));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
