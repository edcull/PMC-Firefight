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
const { C, R } = require('./rules.js');
const P = require('../src/engine/protocol.js');
const Cmds = require('./campcmds.js');

function inviteCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)];
  return s;
}

/* ================= the battle, and after it =================
   Both players ready: the battle is made from the contract (as the hotseat
   dossier's fight() makes one) and fought as an online battle. When it ends, the
   aftermath is applied here, once — by the battle's id — with each player's own
   post-battle questions asked of them (as dossier-after.js asks them at one screen). */
const colourOf = (co) => (P.COLOURS.indexOf(co.colour) >= 0 ? co.colour : null);
function battleConfig(camp) {
  const k = camp.online.contract, A = camp.companies.A, B = camp.companies.B;
  const picks = { A: Cmds.pickEntries(A, k.picks.A), B: Cmds.pickEntries(B, k.picks.B) };
  // Drug Dealer: the chosen few go in Determined
  ['A', 'B'].forEach((sd) => {
    picks[sd].forEach((e) => { delete e.drugged; });
    const co = camp.companies[sd];
    if (!C.hasDoctrine(co, 'V4')) return;
    const want = k.picks[sd].drugs || [];
    Cmds.drugAble(picks[sd]).filter((e) => want.indexOf(e.rid) >= 0).forEach((e) => { e.drugged = true; });
  });
  camp.pending = {
    tier: k.tier, pl: k.pl, scenario: k.scenario.id,
    A: picks.A.map((e) => e.rid), B: picks.B.map((e) => e.rid),
    drugged: picks.A.concat(picks.B).filter((e) => e.drugged).map((e) => e.rid)
  };
  const bench = (co, pk) => co.roster.filter((e) => pk.indexOf(e) < 0 && !(e.restUntil > 0));
  return {
    tier: k.tier, pl: k.pl, scenario: k.scenario.id, roles: k.roles || null,
    armyA: picks.A.map((e) => R.entryPick(e)), armyB: picks.B.map((e) => R.entryPick(e)),
    nameA: A.name, nameB: B.name, colourA: colourOf(A), colourB: colourOf(B) || (colourOf(A) === 'steel' ? 'ochre' : 'steel'),
    dossier: { A: picks.A, B: picks.B },
    bench: { A: bench(A, picks.A), B: bench(B, picks.B) },
    doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() },
    tactics: { A: A.faction === 'rebel' ? k.picks.A.tactic || null : null, B: B.faction === 'rebel' ? k.picks.B.tactic || null : null },
    campaign: true, mode: 'hotseat', readyUp: true,
    planet: k.planet && k.planet !== 'random' ? k.planet : null, terrainSetup: 'auto'
  };
}
// the post-battle questions, in the order the book puts them (dossier-after.js onFinish)
function postSteps(camp, report) {
  const players = ['A', 'B'], steps = [];
  players.forEach((sd) => { if (report.winner === sd && C.hasDoctrine(camp.companies[sd], 'V2')) steps.push({ kind: 'plunder', side: sd }); });
  players.forEach((sd) => {
    if (C.hasDoctrine(camp.companies[sd], 'S2')) steps.push({ kind: 'negotiate', side: sd });
    if (C.hasDoctrine(camp.companies[sd], 'V5')) steps.push({ kind: 'weak', side: sd });
  });
  return steps;
}
// every question answered: the aftermath applied, and kept for each player to read
function finishPost(camp) {
  const post = camp.post, opts = {};
  Object.keys(post.pre).forEach((k) => { opts[k] = post.pre[k]; });
  opts.defer = true;
  const after = C.aftermath(camp, post.report, opts);
  after.loss = {};
  ['A', 'B'].forEach((sd) => {
    let st = 0, en = 0;
    (post.report.units || []).forEach((l) => {
      if (l.side !== sd) return;
      st += l.startSize || 0;
      en += l.wiped || l.destroyed ? 0 : Math.min(l.endSize || 0, l.startSize || 0);
    });
    after.loss[sd] = st ? Math.round(100 * (st - en) / st) : null;
  });
  const keep = { turn: after.turn, winner: after.winner, payment: after.payment, loss: after.loss, sides: { A: after.sides.A, B: after.sides.B || null }, rival: null, fronts: null, elsewhere: [] };
  const last = camp.log[camp.log.length - 1];
  if (last && last.turn === after.turn) {
    last.after = JSON.parse(JSON.stringify(keep));
    last.balance = camp.companies.A.kUC;
    last.balances = { A: camp.companies.A.kUC, B: camp.companies.B.kUC };
  }
  camp.online.after = JSON.parse(JSON.stringify(keep));
  camp.post = null;
  camp.pending = null;
}

/* The next question, made ready to be asked: No Place for the Weak! wants the
   battle's Trauma Points (and the salvage dice before them) rolled — here, so the
   dice are the server's — and is passed over when nobody qualifies (as the
   dossier's postView does). Every question answered: the aftermath. */
function prepPost(camp) {
  const post = camp.post;
  while (post && post.steps.length) {
    const st = post.steps[0];
    if (st.kind !== 'weak') break;
    const pre = post.pre;
    if (!pre.tp[st.side]) {
      pre.salvage = pre.salvage || {};
      pre.salvage[st.side] = C.salvageRolls(camp, post.report, st.side, pre.salvage[st.side]);
      pre.tp[st.side] = C.rollTP(camp, post.report, st.side);
    }
    if (C.weakCandidates(camp, st.side, pre.tp[st.side]).length) break;
    post.steps.shift();
  }
  if (post && !post.steps.length) finishPost(camp);
}

function create(opts) {
  const db = opts.db, notify = opts.notify || function () { };
  // makes the battle (lobby.campaignBattle): its room's code
  const startBattle = opts.startBattle || null;
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
  /* The campaign as one player is to see it: the other player's pick left out of
     any contract until both are ready (decision 4). */
  function shown(flat, side) {
    if (!flat || !flat.online || !flat.online.contract) return flat;
    const out = Object.assign({}, flat, { online: Object.assign({}, flat.online, { contract: Cmds.contractFor(flat.online.contract, side) }) });
    return out;
  }
  function sideOf(id, userId) {
    const m = db.members(id).filter((x) => x.user_id === userId)[0];
    return m ? m.side : null;
  }

  /* A post-battle question, answered by the player it is put to, in its turn
     (dossier.js: plunder, negotiate, data-weak, postnext, reborn). */
  function postCommand(camp, side, cmd, a) {
    if (cmd === 'postReborn') {
      const rec = camp.online.after && camp.online.after.sides[side];
      const offer = rec && rec.rebornOffer && rec.rebornOffer[+a.i];
      if (!offer) return no('no such unit to bring back');
      if (offer.done) return no('that unit has been brought back already');
      const rr = C.rebirth(camp.companies[side], offer);
      if (rr.ok) {
        offer.done = rr;
        // the log's copy of the aftermath, which the page reads, says so too
        const last = camp.log[camp.log.length - 1];
        const lo = last && last.after && last.after.sides && last.after.sides[side] && last.after.sides[side].rebornOffer;
        if (lo && lo[+a.i]) lo[+a.i].done = rr;
      }
      return rr;
    }
    const post = camp.post, st = post && post.steps[0];
    if (!st) return no('there is no question to answer');
    if (st.side !== side) return no('waiting for the other player\u2019s answer');
    const pre = post.pre;
    if (cmd === 'postPlunder') {
      if (st.kind !== 'plunder' || (pre.plunder[side] && pre.plunder[side].now)) return no('not now');
      const was = pre.dice[side];
      pre.dice[side] = C.rollPayment(post.report.battleTier, post.report.pl);
      pre.plunder[side] = { was: was.slice(), now: pre.dice[side].slice() };
      return { ok: true };
    }
    if (cmd === 'postNegotiate') {
      if (st.kind !== 'negotiate' || pre.neg[side]) return no('not now');
      const dice = pre.dice[side].slice(), cap = Math.ceil(dice.length / 2);
      const sel = Array.from(new Set((Array.isArray(a.sel) ? a.sel : []).map(Number))).filter((i) => i >= 0 && i < dice.length).slice(0, cap);
      if (!sel.length) return no('pick the dice to roll again');
      const sw = sel.map((i) => { const was = dice[i]; dice[i] = 1 + Math.floor(Math.random() * 6); return { was: was, now: dice[i] }; });
      pre.dice[side] = dice;
      pre.neg[side] = { dice: dice.slice(), swapped: sw, idx: sel };
      return { ok: true };
    }
    if (cmd === 'postWeak') {
      if (st.kind !== 'weak') return no('not now');
      const cand = C.weakCandidates(camp, side, pre.tp[side] || {}).map((e) => e.rid);
      if (a.choice && cand.indexOf(String(a.choice)) < 0) return no('that unit is not one of those to choose from');
      pre.weak[side] = a.choice ? String(a.choice) : false;
      post.steps.shift();
    } else if (cmd === 'postNext') {
      if (st.kind === 'weak') return no('say who is executed, or spare them');
      post.steps.shift();
    } else return no('no such command');
    prepPost(camp);
    return { ok: true };
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
        state: shown(row.state, side)
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
        const r = /^post/.test(cmd) ? postCommand(camp, side, cmd, args || {}) : Cmds.run(camp, side, cmd, args);
        if (!r.ok) { out = Object.assign({ code: 400 }, r); return; }
        // both ready: the battle is made from the contract, its room's code kept for both to walk into
        if (cmd === 'contractReady' && r.both) {
          if (!startBattle) { out = no('this server cannot run battles'); return; }
          const cfg = battleConfig(camp);
          const members = db.members(id), seat = (sd) => { const m = members.filter((x) => x.side === sd)[0]; return { id: 'u' + m.user_id, pub: m.pub, name: m.name }; };
          const code = startBattle({ campaignId: id, name: camp.companies.A.name + ' v ' + camp.companies.B.name, cfg: cfg, seats: { A: seat('A'), B: seat('B') } });
          camp.online.battle = { code: code, at: now() };
          r.battle = code;
        }
        const saved = db.saveOnline({ id: id, version: row.version, state: C.forSave(camp), name: nameOf(camp), turn: camp.turn, at: now() });
        if (!saved) { out = no('the campaign changed meanwhile — try again', 409); return; }
        out = Object.assign({}, r, { version: row.version + 1, state: shown(C.forSave(camp), side) });
      });
      if (out.ok) {
        db.members(id).forEach((m) => {
          if (m.user_id !== me.userId) notify(m.user_id, { t: 'camp.changed', id: id });
          if (out.battle) notify(m.user_id, { t: 'camp.battle', id: id, code: out.battle });
        });
      }
      return out;
    },

    /* The battle is over (lobby.js finished): its aftermath applied once, by the
       battle's id, the post-battle questions put to their players, and both told. */
    battleOver(id, report, gameId) {
      let done = false;
      db.transaction(() => {
        const row = db.campaign(id);
        if (!row || row.kind !== 'online') return;
        const camp = load(row);
        camp.online.applied = camp.online.applied || [];
        if (gameId != null && camp.online.applied.indexOf(gameId) >= 0) return;
        if (!camp.pending) return;
        report.battleTier = camp.pending.tier; report.pl = camp.pending.pl; report.scenario = camp.pending.scenario;
        const steps = postSteps(camp, report), askReborn = { A: true, B: true };
        const inc = C.rollIncome(report.battleTier, report.pl, camp.companies.A, camp.companies.B, report.winner, ['A', 'B']);
        camp.post = { report: report, pre: { dice: inc.dice, plunder: inc.plunder, neg: inc.neg, tp: {}, weak: {}, askReborn: askReborn }, steps: steps };
        prepPost(camp);
        camp.online.contract = null;
        camp.online.battle = null;
        if (gameId != null) camp.online.applied = camp.online.applied.concat([gameId]).slice(-50);
        done = db.saveOnline({ id: id, version: row.version, state: C.forSave(camp), name: nameOf(camp), turn: camp.turn, at: now() });
      });
      if (done) db.members(id).forEach((m) => notify(m.user_id, { t: 'camp.changed', id: id }));
      return done;
    }
  };
}

module.exports = { create: create };
