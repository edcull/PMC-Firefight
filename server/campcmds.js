/* What a player may do to an online campaign between battles (multiplayer plan,
   phase 3b), as commands the server runs with the campaign's own rules — the same
   functions the dossier calls in a solo or hotseat campaign. Each acts only on the
   sender's own company, and a die (an honour drawn) is rolled here, never by the
   player's browser.

   A command is { cmd, args }; it returns { ok: true, ... } or { ok: false, why }. */
'use strict';
const { R, C, SC } = require('./rules.js');

const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
function entry(co, rid) { return C.byRid(co, rid) || null; }
const no = (why) => ({ ok: false, why: why });

const COMMANDS = {
  /* Founding a player's own force: its kind, name, colours, the units and the
     starting doctrine, checked as the founding screen checks them. Once only. */
  found(camp, side, a) {
    const co = camp.companies[side];
    if (co.roster && co.roster.length) return no('this force is founded already');
    const faction = ['pmc', 'rebel', 'bugs', 'xeno'].indexOf(a.faction) >= 0 ? a.faction : 'pmc';
    const name = text(a.name, 40);
    if (!name) return no('a force needs a name');
    const other = camp.companies[side === 'A' ? 'B' : 'A'];
    if (other && other.name && other.name.toLowerCase() === name.toLowerCase()) return no('the other force is called that');
    if (other && other.colour && a.colour === other.colour) return no('the other force wears that colour');
    const fresh = C.newCompany(name, { faction: faction });
    Object.keys(fresh).forEach((k) => { co[k] = fresh[k]; });
    co.name = name;
    if (a.colour) co.colour = text(a.colour, 20);
    const keys = (Array.isArray(a.keys) ? a.keys : []).slice(0, 12).map((k) => text(k, 40));
    if (keys.some((k) => { const p = R.profile(R.splitPick(k).key); return !p || p.faction !== faction; })) return no('a force founds from its own list');
    const chk = C.found(co, keys, text(a.doctrine, 8) || null);
    if (!chk.ok) { co.roster = []; co.doctrines = []; return no(chk.faults.join(' ')); }
    return { ok: true };
  },
  recruit(camp, side, a) {
    return C.recruit(camp.companies[side], text(a.key, 40), { drone: !!a.drone, riders: !!a.riders });
  },
  disband(camp, side, a) {
    const co = camp.companies[side], e = entry(co, a.rid);
    return e ? C.disband(co, e) : no('no such unit');
  },
  rename(camp, side, a) {
    const e = entry(camp.companies[side], a.rid), name = text(a.name, 28);
    if (!e) return no('no such unit');
    if (!name) return no('a unit needs a name');
    e.name = name;
    return { ok: true };
  },
  renameSoldier(camp, side, a) {
    const e = entry(camp.companies[side], a.rid);
    if (!e) return no('no such unit');
    return C.renameSoldier(e, +a.i, text(a.name, 32)) ? { ok: true } : no('no such soldier');
  },
  promote(camp, side, a) {
    const co = camp.companies[side], e = entry(co, a.rid);
    return e ? C.promoteUnit(co, e, text(a.to, 40)) : no('no such unit');
  },
  /* Battle Honours (p. 88): the player names three the unit has not earned, and one
     of them is drawn — here, so the draw is the server's. */
  honour(camp, side, a) {
    const co = camp.companies[side], e = entry(co, a.rid);
    if (!e) return no('no such unit');
    const picks = Array.isArray(a.picks) ? a.picks.map(Number) : [];
    const open = C.availableHonours(e).map((h) => h.n);
    if (picks.length !== 3 || new Set(picks).size !== 3 || picks.some((n) => open.indexOf(n) < 0)) return no('name three honours this unit could still earn');
    const H = C.honourTable(e.key);
    const won = C.chooseHonour(picks.map((n) => H[n - 1]));
    const r = C.takeHonour(co, e, won.n);
    return r.ok ? { ok: true, won: won.n } : r;
  },
  upgrade(camp, side, a) {
    const co = camp.companies[side], e = entry(co, a.rid);
    return e ? C.takeUpgrade(co, e, +a.n) : no('no such unit');
  },
  // a mounted unit changes what it rides
  mount(camp, side, a) {
    const e = entry(camp.companies[side], a.rid), m = text(a.mount, 20);
    if (!e) return no('no such unit');
    if (!R.MOUNTS || !R.MOUNTS[m]) return no('no such mount');
    e.mount = m;
    return { ok: true };
  },
  takeDoctrine(camp, side, a) {
    const co = camp.companies[side], id = text(a.id, 8);
    const can = C.canTakeDoctrine(co, id);
    if (!can.ok) return can;
    co.doctrines.push(id);
    return { ok: true };
  },
  swapDoctrine(camp, side, a) {
    return C.swapDoctrine(camp.companies[side], text(a.out, 8), text(a.in, 8));
  },
  promoteCompany(camp, side) { return C.promoteCompany(camp.companies[side]); },
  aspire(camp, side) {
    const co = camp.companies[side];
    if (!C.canAspire(co)) return no('this force cannot aspire to the next Tier yet');
    co.aspiring = true;
    return { ok: true };
  },
  colour(camp, side, a) {
    const co = camp.companies[side], other = camp.companies[side === 'A' ? 'B' : 'A'], c = text(a.colour, 20);
    if (other && other.colour === c) return no('the other force wears that colour');
    co.colour = c;
    return { ok: true };
  }
};

/* ================= the contract (phase 3b) =================
   Either player calls for one; the server rolls its terms as the hotseat contract
   does (dossier-contract.js beginContract): the Battle Tier, the scenario (and
   Foresighted Command's dice), the Priority Levels on offer, and the attacker and
   defender. The doctrines that bend it are each asked of the player who holds
   them. Then each player picks their force on their own device — hidden from the
   other until both are ready (decision 4) — and when both are, the battle is made. */
const other = (sd) => (sd === 'A' ? 'B' : 'A');
function contractOf(camp) { return camp.online && camp.online.contract; }
// anything that changes the terms puts both players' picks back in their hands
function unready(k) { k.ready = { A: false, B: false }; }
function rollRolesFor(camp, k) {
  k.roles = SC.rollRoles(k.scenario.id, { A: camp.companies.A.doctrines || [], B: camp.companies.B.doctrines || [] }, null, ['A', 'B']);
}
// the units a pick is: its roster units, and any fielded for this battle alone (turrets, platforms)
function pickEntries(co, pick) {
  const out = [];
  (pick.rids || []).forEach((rid) => { const e = C.byRid(co, rid); if (e) out.push(e); });
  (pick.field || []).forEach((key) => { const e = C.newEntry(key); e.fielded = true; out.push(e); });
  return out;
}
function drugAble(picks) {
  return picks.filter((e) => { const p = R.profile(e.key); return p.cls === 'infantry' && p.group !== 'First Among Equals' && !p.command; });
}

Object.assign(COMMANDS, {
  contractBegin(camp) {
    if (contractOf(camp)) return no('a contract is already being drawn up');
    const A = camp.companies.A, B = camp.companies.B;
    if (!(A.roster || []).length || !(B.roster || []).length) return no('both forces must be founded first');
    const tier = C.rollBattleTier(A, B), fs = C.foresight(A, B, false), levels = C.levelsFor(A, B, tier.tier);
    const k = {
      tierRoll: tier, tier: tier.tier, levels: levels, pl: levels.length ? levels[levels.length - 1] : 1,
      scenario: fs.scenario || fs.fore.dice[0], planet: 'random',
      alt: fs.alt || null, altBy: fs.altBy || (fs.alt ? 'A' : null), altUsed: false,
      fore: fs.fore || null, foreNote: fs.note || null,
      roles: null, terms: {}, picks: { A: null, B: null }, ready: { A: false, B: false }, turn: camp.turn || 0
    };
    if (k.scenario && !(k.fore && !k.fore.done)) rollRolesFor(camp, k);
    camp.online.contract = k;
    return { ok: true };
  },
  /* On Our Terms… (p. 87): a holder moves the Battle Tier one step, up or down; with
     both holding it, it moves only if both choose the same way. Once each. */
  contractTerms(camp, side, a) {
    const k = contractOf(camp);
    if (!k) return no('there is no contract');
    const mine = camp.companies[side], theirs = camp.companies[other(side)];
    if (!C.hasDoctrine(mine, 'S4')) return no('only On Our Terms\u2026 moves the Battle Tier');
    if (k.terms[side] !== undefined) return no('you have had your say on the terms');
    const dir = Math.sign(+a.dir || 0);
    k.terms[side] = dir;
    const both = C.hasDoctrine(theirs, 'S4');
    const shift = (d) => {
      const was = k.tier;
      k.tier = Math.max(1, Math.min(k.tierRoll.cap, k.tier + d));
      k.levels = C.levelsFor(camp.companies.A, camp.companies.B, k.tier);
      if (k.levels.indexOf(k.pl) < 0) k.pl = k.levels[0] || 1;
      if (k.tier !== was) { k.picks = { A: null, B: null }; unready(k); }
    };
    if (!both) { if (dir) shift(dir); }
    else if (k.terms[other(side)] !== undefined) { if (dir && dir === k.terms[other(side)]) shift(dir); }
    return { ok: true };
  },
  // Foresighted Command with its dice out: the player whose turn it is sets one aside (XEN-11)
  contractForego(camp, side, a) {
    const k = contractOf(camp);
    if (!k || !k.fore || k.fore.done) return no('nothing to set aside');
    const who = k.fore.order[k.fore.ignored.length];
    if (who !== side) return no('it is the other player\u2019s to choose');
    if (!C.foreIgnore(k, who, +a.i, false)) return no('not that one');
    if (k.fore.done) rollRolesFor(camp, k);
    unready(k);
    return { ok: true };
  },
  // Foresighted Command's other scenario, taken instead by the player who holds it (once)
  contractForesee(camp, side) {
    const k = contractOf(camp);
    if (!k || !k.alt) return no('there is no other scenario to take');
    if ((k.altBy || 'A') !== side) return no('only the holder of Foresighted Command may');
    if (k.altUsed) return no('Foresighted Command has been used');
    const was = k.scenario;
    k.scenario = k.alt; k.alt = was; k.altUsed = true;
    rollRolesFor(camp, k);
    k.picks = { A: null, B: null }; unready(k);
    return { ok: true };
  },
  // The Best Defence is Good Offence, taken up by the defender who holds it: a D6, rolled here
  contractBestDefence(camp, side) {
    const k = contractOf(camp);
    const bd = k && k.roles && k.roles.bestDefence;
    if (!bd || !bd.pending) return no('there is nothing to take up');
    if (bd.side !== side) return no('it is the other player\u2019s');
    SC.bestDefence(k.roles);
    unready(k);
    return { ok: true, roll: k.roles.bestDefence.roll, swapped: k.roles.bestDefence.swapped };
  },
  // the Priority Level and the world: Player 1's to set, as at one screen
  contractLevel(camp, side, a) {
    const k = contractOf(camp);
    if (!k) return no('there is no contract');
    if (side !== 'A') return no('Player 1 sets the Priority Level and the world');
    if (a.pl != null) {
      if (k.levels.indexOf(+a.pl) < 0) return no('not a Priority Level on offer');
      if (+a.pl !== k.pl) { k.pl = +a.pl; k.picks = { A: null, B: null }; unready(k); }
    }
    if (a.planet != null) k.planet = text(a.planet, 20) || 'random';
    return { ok: true };
  },
  /* A player's force for the battle: from their own roster (none resting), any
     fielded for this battle alone, a rebel's tactic, and Drug Dealer's chosen
     few. Kept from the other player until both are ready. */
  contractPick(camp, side, a) {
    const k = contractOf(camp);
    if (!k) return no('there is no contract');
    if (k.fore && !k.fore.done) return no('Foresighted Command\u2019s dice are still out');
    const co = camp.companies[side];
    const rids = (Array.isArray(a.rids) ? a.rids : []).map((r) => text(r, 40));
    if (new Set(rids).size !== rids.length) return no('a unit is picked once');
    for (const r of rids) {
      const e = C.byRid(co, r);
      if (!e) return no('that unit is not yours');
      if (e.restUntil > 0) return no(e.name + ' is resting');
    }
    const field = (Array.isArray(a.field) ? a.field : []).map((x) => text(x, 40)).slice(0, 8);
    for (const key of field) {
      const p = R.profile(key);
      if (!p || p.faction !== (co.faction || 'pmc') || !(C.isTurretP(p) || p.noSlot) || !(p.tier <= k.tier || k.pl > 1)) return no('that cannot be fielded');
    }
    const tactic = co.faction === 'rebel' && a.tactic && R.TACTICS.some((t) => t.id === a.tactic) ? a.tactic : null;
    const pick = { rids: rids, field: field, tactic: tactic, drugs: [] };
    const units = pickEntries(co, pick);
    const chk = R.checkArmy(units.map((e) => R.entryPick(e)), k.tier, k.pl, co.doctrines, tactic, co.faction);
    if (!chk.ok) return no((chk.faults || ['that force cannot be fielded']).join(' '));
    if (C.hasDoctrine(co, 'V4')) {
      const able = drugAble(units).map((e) => e.rid), cap = Math.ceil(able.length / 3);
      pick.drugs = (Array.isArray(a.drugs) ? a.drugs : []).map((r) => text(r, 40)).filter((r) => able.indexOf(r) >= 0).slice(0, cap);
    }
    k.picks[side] = pick;
    k.ready[side] = false;
    return { ok: true };
  },
  // ready to fight with the force picked (or not, after all); both ready makes the battle
  contractReady(camp, side, a) {
    const k = contractOf(camp);
    if (!k) return no('there is no contract');
    if (a.ready === false) { k.ready[side] = false; return { ok: true }; }
    if (!k.picks[side]) return no('pick a force first');
    if (k.fore && !k.fore.done) return no('Foresighted Command\u2019s dice are still out');
    k.ready[side] = true;
    return { ok: true, both: k.ready.A && k.ready.B };
  }
});

/* What one player is shown of a contract: everything but the other player's pick,
   until both are ready (decision 4) — only whether they have picked, and are ready. */
function contractFor(k, side) {
  if (!k) return null;
  const out = JSON.parse(JSON.stringify(k));
  const them = other(side);
  if (!(k.ready.A && k.ready.B) && out.picks[them]) out.picks[them] = { hidden: true };
  return out;
}

/* One command, run against a campaign (rehydrated) for the player on `side`. A
   battle being fought holds everything until it is over. */
function run(camp, side, cmd, args) {
  const fn = Object.prototype.hasOwnProperty.call(COMMANDS, cmd) ? COMMANDS[cmd] : null;
  if (!fn) return no('no such command');
  if (!camp.companies[side]) return no('no such force');
  if (camp.pending) return no('a battle is being fought — this waits until it is over');
  if (cmd !== 'found' && !(camp.companies[side].roster || []).length) return no('found the force first');
  let r;
  try { r = fn(camp, side, args || {}) || { ok: true }; }
  catch (e) { return no('that could not be done: ' + ((e && e.message) || e)); }
  // a force changed while a contract is out: its pick goes back to its player, to pick again
  const k = contractOf(camp);
  if (r.ok && k && cmd.indexOf('contract') !== 0 && k.picks[side]) { k.picks[side] = null; k.ready[side] = false; }
  return r;
}

module.exports = { run: run, COMMANDS: COMMANDS, contractFor: contractFor, pickEntries: pickEntries, drugAble: drugAble };
