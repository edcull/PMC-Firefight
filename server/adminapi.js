/* What an admin may do from the game itself (their account screen): look at the
   server — its health, the accounts, the battles, the campaigns — help a player
   (activate their account, send them an activation or a password-reset email),
   close a stuck battle, clear out old finished ones, take a backup; and, with
   their own password typed again and a backup taken first, remove a battle, a
   campaign or an account. Who is an admin, a password set for someone, the
   database itself: none of that is here — those stay with the console (admin.js).

   Every request is checked here, on the server, against the account's admin flag
   in the database; every change is written to the log, with who made it. */
'use strict';

function create(opts) {
  const db = opts.db, auth = opts.auth, lobby = opts.lobby, games = opts.games, backups = opts.backups;
  const log = opts.log || function () { };
  const health = opts.health || function () { return {}; };
  const now = opts.now || Date.now;
  // at most this many admin changes a minute from one account: a slip of the mouse, not a script
  const recent = new Map();
  function busy(me) {
    const t = now(), list = (recent.get(me.userId) || []).filter((x) => t - x < 60000);
    list.push(t); recent.set(me.userId, list);
    return list.length > 30;
  }
  const no = (why, code) => ({ ok: false, why: why, code: code || 400 });
  const users = () => db.users().map((u) => ({ name: u.name, admin: !!u.admin, active: !!u.active, email: u.email || null, emailOk: !!u.email_ok, created: u.created, seen: u.seen }));
  const shownGame = (g) => ({
    code: g.code, name: g.name, status: g.status, moves: g.moves, updated: g.updated, created: g.created,
    players: ['A', 'B'].map((sd) => (g.seats && g.seats[sd] && g.seats[sd].name) || null),
    kind: g.settings && g.settings.onlineCampaign ? 'campaign battle' : g.settings && g.settings.kind === 'coop' ? 'co-op' : 'skirmish',
    winner: g.result && g.result.winner ? ((g.seats[g.result.winner] && g.seats[g.result.winner].name) || g.result.winner) : null,
    forfeit: !!(g.result && g.result.forfeit), open: lobby && lobby.rooms ? lobby.rooms.has(g.code) : false
  });
  const campaigns = () => db.allCampaigns(100).map((c) => ({
    id: c.id, kind: c.kind, name: c.name, turn: c.turn || 0, updated: c.updated, owner: c.owner || null,
    players: c.kind === 'online' ? db.members(c.id).map((m) => ({ side: m.side, name: m.name })) : null, invite: c.invite || null
  }));

  // a destructive change: the admin's own password again, and a backup first
  async function guarded(me, pass, what, fn) {
    const user = db.userById(me.userId);
    if (!(await auth.passwordOk(user, pass))) return no('that is not your password', 401);
    if (backups) { const f = await backups.make(); if (!f) return no('the backup before it failed, so nothing was removed'); }
    const r = fn();
    if (r && r.ok === false) return r;
    log('admin ' + me.name + ' removed ' + what);
    return Object.assign({ ok: true }, r || {});
  }

  return {
    async handle(me, action, b) {
      if (!me || me.guest) return no('sign in first', 401);
      const fresh = db.userById(me.userId);
      if (!fresh || !fresh.admin) return no('that is for admins', 403);
      b = b || {};
      if (action === 'overview') {
        return { ok: true, stats: db.stats(), health: health(), users: users(), games: db.allGames(60).map(shownGame), campaigns: campaigns() };
      }
      if (busy(me)) return no('too many admin changes in a minute — wait a moment', 429);
      const target = () => b.name ? db.userByName(String(b.name)) : null;
      switch (action) {
        /* The personalities (archetypes.js): a whole one from the editor, kept as its
           difference from the default, or put back to the default. */
        case 'archetype-save': {
          if (!opts.archetypes) return no('this server keeps no personalities');
          const r = opts.archetypes.save(String(b.id || ''), b.data, me.name, now());
          if (!r.ok) return no(r.why);
          log('admin ' + me.name + ' changed the personality ' + b.id);
          return { ok: true, text: 'Saved.', change: r.change, version: r.version };
        }
        case 'archetype-reset': {
          if (!opts.archetypes) return no('this server keeps no personalities');
          const r2 = opts.archetypes.reset(String(b.id || ''), me.name);
          log('admin ' + me.name + ' reset the personality ' + b.id);
          return { ok: true, text: 'Back to its default.', version: r2.version };
        }
        case 'activate': {
          const u = target();
          if (!u) return no('no such account');
          db.activate(u.id);
          log('admin ' + me.name + ' activated ' + u.name);
          return { ok: true, text: u.name + ' is active.' };
        }
        case 'resend': {
          const u = target();
          if (!u) return no('no such account');
          if (u.active) return no(u.name + ' is already active');
          if (!u.email) return no(u.name + ' has no email address');
          await auth.resend(u.name, 'admin');
          log('admin ' + me.name + ' resent ' + u.name + '’s activation link');
          return { ok: true, text: 'The activation link has been sent to ' + u.name + ' again.' };
        }
        case 'reset-link': {
          const u = target();
          if (!u) return no('no such account');
          if (!u.email) return no(u.name + ' has no email address: reset their password from the console');
          await auth.forgot(u.email, 'admin');
          log('admin ' + me.name + ' sent ' + u.name + ' a password-reset link');
          return { ok: true, text: 'A link to choose a new password has been sent to ' + u.name + '.' };
        }
        case 'close-game': {
          const code = String(b.code || '').toUpperCase();
          const r = lobby && lobby.adminClose ? lobby.adminClose(code) : false;
          if (!r) return no('no battle under way with the code ' + code);
          log('admin ' + me.name + ' closed battle ' + code);
          return { ok: true, text: 'Battle ' + code + ' is closed: its players were told.' };
        }
        case 'prune': {
          const days = Math.max(1, +b.days || 30), ids = db.oldGames(now() - days * 86400000);
          ids.forEach((id) => db.dropGame(id));
          log('admin ' + me.name + ' cleared ' + ids.length + ' finished battles older than ' + days + ' days');
          return { ok: true, text: ids.length ? 'Cleared ' + ids.length + ' finished battle' + (ids.length === 1 ? '' : 's') + ' older than ' + days + ' days.' : 'No finished battles older than ' + days + ' days.' };
        }
        case 'backup': {
          if (!backups) return no('this server keeps no backups');
          const f = await backups.make();
          if (!f) return no('the backup failed (the log says why)');
          log('admin ' + me.name + ' took a backup');
          return { ok: true, text: 'Backed up: ' + require('path').basename(f) + '.' };
        }
        case 'delete-game': {
          const code = String(b.code || '').toUpperCase(), list = db.gamesByCode(code);
          if (!list.length) return no('no battle with the code ' + code);
          return guarded(me, b.password, 'battle ' + code, () => {
            if (lobby && lobby.adminClose) lobby.adminClose(code);
            list.forEach((g) => db.dropGame(g.id));
            return { text: 'Battle ' + code + ' removed.' };
          });
        }
        case 'delete-campaign': {
          const c = db.campaign(+b.id);
          if (!c) return no('no such campaign');
          return guarded(me, b.password, 'campaign ' + c.id + ' (' + c.name + ')', () => {
            db.dropAnyCampaign(c.id);
            return { text: c.name + ' removed' + (c.kind === 'online' ? ', for all its players.' : '.') };
          });
        }
        case 'delete-user': {
          const u = target();
          if (!u) return no('no such account');
          if (u.id === me.userId) return no('you cannot remove your own account here');
          if (u.admin) return no('an admin’s account is removed from the console');
          return guarded(me, b.password, 'the account ' + u.name, () => {
            db.dropUser(u.id);
            return { text: u.name + '’s account removed.' };
          });
        }
      }
      return no('unknown admin action', 404);
    }
  };
}

module.exports = { create: create };
