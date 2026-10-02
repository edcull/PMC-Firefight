/* What a player may do to an online campaign between battles (multiplayer plan,
   phase 3b), as commands the server runs with the campaign's own rules — the same
   functions the dossier calls in a solo or hotseat campaign. Each acts only on the
   sender's own company, and a die (an honour drawn) is rolled here, never by the
   player's browser.

   A command is { cmd, args }; it returns { ok: true, ... } or { ok: false, why }. */
'use strict';
const { R, C } = require('./rules.js');

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

/* One command, run against a campaign (rehydrated) for the player on `side`. A
   battle being fought holds everything until it is over. */
function run(camp, side, cmd, args) {
  const fn = Object.prototype.hasOwnProperty.call(COMMANDS, cmd) ? COMMANDS[cmd] : null;
  if (!fn) return no('no such command');
  if (!camp.companies[side]) return no('no such force');
  if (camp.pending) return no('a battle is being fought — this waits until it is over');
  if (cmd !== 'found' && !(camp.companies[side].roster || []).length) return no('found the force first');
  try { return fn(camp, side, args || {}) || { ok: true }; }
  catch (e) { return no('that could not be done: ' + ((e && e.message) || e)); }
}

module.exports = { run: run, COMMANDS: COMMANDS };
