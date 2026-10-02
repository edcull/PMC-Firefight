/* Online campaigns (multiplayer plan, phase 3b): two players, each on their own
   device, each with a company of their own, playing whenever they like between
   battles (decision 6). The server keeps the campaign and owns its rules: a player
   sends a command (campcmds.js), the server runs it on the campaign as it stands,
   saves it, and tells the other player it has changed.

   An online campaign is kept as a two-player campaign — the same shape a hotseat
   one has, so the rules' two-player paths serve it (no AI rivals, an aftermath for
   each player) — marked `online`, in the database's campaigns table with its two
   members and an invite code for the second. */
'use strict';
const crypto = require('crypto');
const { C } = require('./rules.js');
const Cmds = require('./campcmds.js');

function inviteCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)];
  return s;
}

function create(opts) {
  const db = opts.db, notify = opts.notify || function () { };
  const now = opts.now || Date.now;
  const no = (why, code) => ({ ok: false, why: why, code: code || 400 });

  // a campaign's name in the lists: both forces, once they have names
  function nameOf(camp) {
    const A = camp.companies.A, B = camp.companies.B;
    const n = (co) => (co && co.roster && co.roster.length ? co.name : null);
    return (n(A) || 'Player 1') + ' v ' + (n(B) || (camp.online && camp.online.waiting ? 'an open seat' : 'Player 2'));
  }
  // the campaign as kept, back as the rules want it (Player 2 in companies.B)
  function load(row) { return C.rehydrate(JSON.parse(JSON.stringify(row.state))); }
  function sideOf(id, userId) {
    const m = db.members(id).filter((x) => x.user_id === userId)[0];
    return m ? m.side : null;
  }

  return {
    /* A new online campaign: the player who makes it is Player 1, and is given the
       code that brings Player 2 in. Neither force is founded yet. */
    make(me) {
      if (!me || me.guest) return no('sign in to play a campaign online', 401);
      const camp = C.newCampaign({ mode: 'hotseat', nameA: me.name + '’s force', nameB: 'Player 2’s force' });
      camp.companies.A.roster = []; camp.companies.B.roster = [];
      camp.online = { waiting: true };
      const flat = C.forSave(C.rehydrate(camp));
      let id, code;
      db.transaction(() => {
        id = db.addCampaign({ owner: me.userId, kind: 'online', name: nameOf(camp), turn: 0, state: flat, at: now() });
        db.addMember(id, me.userId, 'A', now());
        for (let tries = 0; tries < 20; tries++) {
          code = inviteCode();
          try { db.setInvite(id, code); break; } catch (e) { code = null; }
        }
      });
      return { ok: true, id: id, invite: code, side: 'A' };
    },

    // the second player, coming in with the code they were given
    join(me, code) {
      if (!me || me.guest) return no('sign in to play a campaign online', 401);
      const row = db.byInvite(String(code || '').trim().toUpperCase());
      if (!row || row.kind !== 'online') return no('no campaign with that code', 404);
      const members = db.members(row.id);
      if (members.some((m) => m.user_id === me.userId)) return { ok: true, id: row.id, side: members.filter((m) => m.user_id === me.userId)[0].side };
      if (members.length >= 2) return no('that campaign has its two players already', 409);
      const camp = load(row);
      camp.online = { waiting: false };
      db.transaction(() => {
        db.addMember(row.id, me.userId, 'B', now());
        db.saveOnline({ id: row.id, version: row.version, state: C.forSave(camp), name: nameOf(camp), turn: camp.turn, at: now() });
      });
      const a = members[0];
      if (a) notify(a.user_id, { t: 'camp.changed', id: row.id });
      return { ok: true, id: row.id, side: 'B' };
    },

    // the player's online campaigns, the latest first
    list(me) {
      if (!me || me.guest) return [];
      return db.onlineOf(me.userId);
    },

    /* The campaign as one of its players sees it: their side, both players' names,
       the invite code while the second seat is open, and the campaign itself. */
    view(me, id) {
      if (!me || me.guest) return no('sign in to play a campaign online', 401);
      const row = db.campaign(id);
      const side = row && row.kind === 'online' && sideOf(id, me.userId);
      if (!side) return no('no such campaign of yours', 404);
      const members = db.members(id);
      return {
        ok: true, id: row.id, version: row.version, side: side,
        players: members.map((m) => ({ side: m.side, name: m.name, id: m.pub })),
        invite: members.length < 2 ? row.invite : null,
        state: row.state
      };
    },

    /* A command from one of its players, run with the campaign's rules on the
       campaign as it stands now, and kept; the other player is told. Commands are
       run one at a time, each over the version the last one left. */
    command(me, id, cmd, args) {
      if (!me || me.guest) return no('sign in to play a campaign online', 401);
      let out = null;
      db.transaction(() => {
        const row = db.campaign(id);
        const side = row && row.kind === 'online' && sideOf(id, me.userId);
        if (!side) { out = no('no such campaign of yours', 404); return; }
        const camp = load(row);
        const r = Cmds.run(camp, side, cmd, args);
        if (!r.ok) { out = Object.assign({ code: 400 }, r); return; }
        const saved = db.saveOnline({ id: id, version: row.version, state: C.forSave(camp), name: nameOf(camp), turn: camp.turn, at: now() });
        if (!saved) { out = no('the campaign changed meanwhile — try again', 409); return; }
        out = Object.assign({}, r, { version: row.version + 1, state: C.forSave(camp) });
      });
      if (out.ok) {
        db.members(id).forEach((m) => { if (m.user_id !== me.userId) notify(m.user_id, { t: 'camp.changed', id: id }); });
      }
      return out;
    }
  };
}

module.exports = { create: create };
