#!/usr/bin/env node
/* Looking after the accounts from the command line, on the machine the server
   runs on: a forgotten password reset, an account whose email never came activated.

     node server/admin.js users
     node server/admin.js create <name> <password> [admin] [email]
     node server/admin.js activate <name>         an account whose emailed link never arrived
     node server/admin.js reset-password <name> <new password>
     node server/admin.js admin <name> on|off
     node server/admin.js delete <name> [--yes]   says what goes with it; --yes removes it
     node server/admin.js backup [file]      a consistent copy, safe while the server runs
     node server/admin.js stats              what the server holds: accounts, battles, campaigns, backups
     node server/admin.js games [n]          the latest battles (30, or n): code, status, players, result
     node server/admin.js game <code>        one battle in full
     node server/admin.js delete-game <code> [--yes]        a battle gone (one still open on the server: restart it after)
     node server/admin.js prune-games <days> [--yes]        finished and abandoned battles older than that, gone
     node server/admin.js campaigns [n]      the campaigns kept: id, kind, name, turn, owner (and an online one's players)
     node server/admin.js delete-campaign <id> [--yes]      a campaign gone (an online one for both its players)

   DATA_DIR says where the database is, as for the server (default: data/ beside server.js). */
'use strict';
const path = require('path');
const DB = require('./db.js');
const Auth = require('./auth.js');

// where the server keeps it: the same rule as server.js
const DATA = process.env.DATA_DIR || (process.env.CAMPAIGNS_DIR ? path.dirname(path.resolve(process.env.CAMPAIGNS_DIR)) : path.join(__dirname, '..', 'data'));
const FILE = path.join(DATA, 'pmc.db');

async function main(argv) {
  const db = DB.open(FILE), auth = Auth.create({ db: db });
  const [cmd, a, b] = argv;
  const say = (t) => console.log(t);
  try {
    if (cmd === 'users') {
      const all = db.users();
      if (!all.length) say('No accounts yet.');
      all.forEach((u) => say(u.name + (u.admin ? '  (admin)' : '') + (u.active ? '' : '  (not activated)') +
        '  ' + (u.email ? u.email + (u.email_ok ? '' : ' (unconfirmed)') : 'no email') + '  made ' + new Date(u.created).toISOString().slice(0, 10) +
        ', last seen ' + new Date(u.seen).toISOString().slice(0, 10)));
      return 0;
    }
    if (cmd === 'create') {
      const em = argv.slice(3).filter((x) => x.indexOf('@') > 0)[0];
      const r = await auth.createUser(a, b, argv.slice(3).indexOf('admin') >= 0, em);
      say(r.ok ? 'Made ' + a + '.' : r.why);
      return r.ok ? 0 : 1;
    }
    if (cmd === 'reset-password') {
      const r = await auth.resetPassword(a, b);
      say(r.ok ? a + '’s password is changed, and every device of theirs signed out.' : r.why);
      return r.ok ? 0 : 1;
    }
    if (cmd === 'activate') {
      const u = db.userByName(a);
      if (!u) { say('No account called ' + a + '.'); return 1; }
      db.activate(u.id);
      say(u.name + ' is active.');
      return 0;
    }
    if (cmd === 'admin') {
      const u = db.userByName(a);
      if (!u) { say('No account called ' + a + '.'); return 1; }
      db.setAdmin(u.id, b !== 'off');
      say(u.name + (b !== 'off' ? ' is now an admin.' : ' is no longer an admin.'));
      return 0;
    }
    if (cmd === 'delete') {
      const u = db.userByName(a);
      if (!u) { say('No account called ' + a + '.'); return 1; }
      const h = db.userHolds(u.id);
      const what = u.name + ': ' + h.owned + ' campaign' + (h.owned === 1 ? '' : 's') + ' of theirs (an online one goes for both players), and their seat in ' +
        h.member + ' online campaign' + (h.member === 1 ? '' : 's') + ' someone else made.';
      if (b !== '--yes') { say('This would remove ' + what + '\nRun it again with --yes to remove the account (a backup first is wise).'); return 1; }
      db.dropUser(u.id);
      say('Removed ' + what);
      return 0;
    }
    if (cmd === 'stats') {
      const st = db.stats(), fs = require('fs');
      const size = (f) => { try { return (fs.statSync(f).size / 1048576).toFixed(1) + ' MB'; } catch (e) { return '?'; } };
      const list = (o) => Object.keys(o).length ? Object.keys(o).map((k) => o[k] + ' ' + k).join(', ') : 'none';
      say('Database   ' + FILE + ' (' + size(FILE) + ')');
      say('Accounts   ' + st.users + (st.inactive ? ' (' + st.inactive + ' not activated)' : '') + ', ' + st.emails + ' with an email address; ' + st.sessions + ' signed-in sessions');
      say('Battles    ' + list(st.games));
      say('Campaigns  ' + list(st.campaigns));
      const bdir = process.env.BACKUP_DIR || path.join(DATA, 'backups');
      let bs = [];
      try { bs = fs.readdirSync(bdir).filter((n) => /^pmc-.*\.db$/.test(n)).sort(); } catch (e) { }
      say('Backups    ' + (bs.length ? bs.length + ' in ' + bdir + ', the last ' + bs[bs.length - 1] : 'none in ' + bdir));
      return 0;
    }
    /* ---- battles ---- */
    const day = (t) => t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '-';
    const players = (g) => ['A', 'B'].map((sd) => (g.seats && g.seats[sd] && g.seats[sd].name) || '(empty)').join(' v ');
    const outcome = (g) => g.status === 'battle' ? 'under way' : !g.result ? g.status : !g.result.winner ? 'drawn'
      : 'won by ' + ((g.seats[g.result.winner] && g.seats[g.result.winner].name) || g.result.winner) + (g.result.forfeit ? ' (forfeit)' : '') + (g.status === 'abandoned' ? ', abandoned' : '');
    const kindOf = (g) => g.settings && g.settings.onlineCampaign ? 'campaign battle' : g.settings && g.settings.kind === 'coop' ? 'co-op' : 'skirmish';
    if (cmd === 'games') {
      const all = db.allGames(+a || 30);
      if (!all.length) { say('No battles kept.'); return 0; }
      all.forEach((g) => say(g.code.padEnd(6) + ' ' + day(g.updated) + '  ' + outcome(g).padEnd(22) + ' ' + kindOf(g).padEnd(15) + ' ' + players(g) + '  — ' + g.name + ' (' + g.moves + (g.moves === 1 ? ' move)' : ' moves)')));
      return 0;
    }
    if (cmd === 'game') {
      const list = db.gamesByCode(String(a || '').toUpperCase());
      if (!list.length) { say('No battle with the code ' + a + '.'); return 1; }
      list.forEach((g) => {
        say(g.code + ' — ' + g.name + ' (row ' + g.id + ')');
        say('  ' + kindOf(g) + ', ' + outcome(g) + '; ' + g.moves + (g.moves === 1 ? ' move kept' : ' moves kept'));
        say('  players  ' + players(g));
        const s = g.settings || {};
        say('  terms    Tier ' + (s.tier || '?') + ', PL ' + (s.pl || '?') + ', ' + (s.kind === 'coop' ? 'scenario ' + (s.soloScen || 'roll') + ', OpFor ' + (s.opFaction || '?') : 'scenario ' + (s.scenario || '?')) + ', world ' + (s.planet || '?'));
        say('  started  ' + day(g.created) + ', last move ' + day(g.updated));
      });
      return 0;
    }
    if (cmd === 'delete-game') {
      const list = db.gamesByCode(String(a || '').toUpperCase());
      if (!list.length) { say('No battle with the code ' + a + '.'); return 1; }
      const what = list.map((g) => g.code + ' (' + outcome(g) + ', ' + players(g) + ')').join(', ');
      if (b !== '--yes') { say('This would remove ' + what + ' and every move kept for it.\nRun it again with --yes to remove it.'); return 1; }
      list.forEach((g) => db.dropGame(g.id));
      say('Removed ' + what + '.' + (list.some((g) => g.status === 'battle') ? ' It was still under way: restart the server (sudo systemctl restart pmc-firefight) so the open table goes too.' : ''));
      return 0;
    }
    if (cmd === 'prune-games') {
      const days = +a;
      if (!(days > 0)) { say('How many days? e.g. prune-games 30'); return 1; }
      const ids = db.oldGames(Date.now() - days * 86400000);
      if (!ids.length) { say('No finished or abandoned battles older than ' + days + ' days.'); return 0; }
      if (b !== '--yes') { say('This would remove ' + ids.length + ' finished or abandoned battle' + (ids.length === 1 ? '' : 's') + ' older than ' + days + ' days.\nRun it again with --yes to remove them.'); return 1; }
      ids.forEach((id) => db.dropGame(id));
      say('Removed ' + ids.length + ' battle' + (ids.length === 1 ? '' : 's') + '.');
      return 0;
    }
    /* ---- campaigns ---- */
    if (cmd === 'campaigns') {
      const all = db.allCampaigns(+a || 30);
      if (!all.length) { say('No campaigns kept.'); return 0; }
      all.forEach((c) => {
        const who = c.kind === 'online' ? db.members(c.id).map((m) => m.name + ' (' + m.side + ')').join(' & ') + (c.invite ? ', code ' + c.invite + ' open' : '') : 'owner ' + (c.owner || '?');
        say(String(c.id).padStart(4) + '  ' + day(c.updated) + '  ' + c.kind.padEnd(8) + ' turn ' + String(c.turn || 0).padEnd(3) + ' ' + c.name + '  — ' + who);
      });
      return 0;
    }
    if (cmd === 'delete-campaign') {
      const c = db.campaign(+a);
      if (!c) { say('No campaign with the id ' + a + ' (see: campaigns).'); return 1; }
      const what = c.name + ' (' + c.kind + ', turn ' + (c.turn || 0) + ')';
      if (b !== '--yes') { say('This would remove ' + what + (c.kind === 'online' ? ', for both its players' : '') + '.\nRun it again with --yes to remove it.'); return 1; }
      db.dropAnyCampaign(c.id);
      say('Removed ' + what + '.');
      return 0;
    }
    if (cmd === 'backup') {
      const to = a || path.join(DATA, 'backup-' + new Date().toISOString().slice(0, 10) + '.db');
      await db.backup(to);
      say('Backed up to ' + to);
      return 0;
    }
    say('Usage: node server/admin.js users | create <name> <password> [admin] [email] | activate <name> | reset-password <name> <password> | admin <name> on|off | delete <name> [--yes] | backup [file] | stats\n' +
      '       games [n] | game <code> | delete-game <code> [--yes] | prune-games <days> [--yes] | campaigns [n] | delete-campaign <id> [--yes]');
    return cmd ? 1 : 0;
  } finally { db.close(); }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
module.exports = { main: main };
