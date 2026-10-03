/* Whose move an online campaign is waiting on, and the email that says so: the
   server works it out from the campaign (a force to found, a contract pick, a
   question after a battle), and a player who has asked for it is emailed when a
   campaign comes to be waiting on them — not for their own moves, not twice in a
   row, and not at all unless they turned it on. */
'use strict';
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const Online = require('../../server/online.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const db = DB.open(':memory:');
  const many = { per: 1000, n: 1000 };
  const auth = Auth.create({ db: db, limits: { loginName: many, loginIp: many, register: many, guest: many } });
  const sent = [];
  const mailer = { live: true, link: (k, t) => 'https://pmc.example/?' + k + '=' + t, send: (m) => { sent.push(m); return Promise.resolve({ ok: true }); } };
  const online = Online.create({ db: db, mailer: mailer });
  const ash = (await auth.register('Ash', 'password one', '1', 'ash@example.com')).who;
  const brann = (await auth.register('Brann', 'password two', '1', 'brann@example.com')).who;
  const waits = (who) => online.list(who)[0].waiting;

  console.log('\nWhose move');
  const made = online.make(ash);
  ok('a new campaign waits on its founder', waits(ash) === 'you');
  online.command(ash, made.id, 'found', { faction: 'pmc', name: 'Iron Wolves', keys: ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], doctrine: 'S2', colour: 'ochre' });
  ok('...founded, it waits on a second player', waits(ash) === 'them');
  online.join(brann, made.invite);
  ok('...joined, on the second player’s force', waits(brann) === 'you' && waits(ash) === 'them');

  console.log('\nBy email, if asked for');
  // Brann turns the emails on; Ash does not
  db.setNotify(brann.userId, true);
  online.command(brann, made.id, 'found', { faction: 'rebel', name: 'Red Dawn', keys: ['rciv', 'rciv', 'rciv', 'rdesconscript', 'rridergang', 'rmilitia', 'rlmg', 'rtechnical'], doctrine: 'H1', colour: 'steel' });
  ok('both founded: either may draw up the next contract', waits(ash) === 'either' && waits(brann) === 'either');
  online.command(ash, made.id, 'contractBegin', {});
  ok('a contract drawn up waits on both picks', waits(ash) === 'you' && waits(brann) === 'you');
  ok('...and Brann, who asked for it, is emailed that it is his move (Ash, who made it, is not)', sent.length === 1 && sent[0].to === 'brann@example.com' && /Your move/.test(sent[0].subject) && /\?campaign=/.test(sent[0].text), JSON.stringify(sent.map((m) => m.to + ': ' + m.subject)));
  online.command(ash, made.id, 'contractBegin', {});
  ok('not again while it is still his move', sent.length === 1);
  db.setNotify(brann.userId, false);
  ok('turned off, the account says so', auth.details(brann).notify === false);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
