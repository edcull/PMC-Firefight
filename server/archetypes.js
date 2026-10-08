/* The personalities as an admin has changed them (campaign.js ARCHETYPES). The
   defaults live in the code; the database keeps only each personality's
   difference from its default, which is laid over it when the server starts and
   whenever an admin saves or resets one. The server's own rolls and campaigns use
   them at once, and a page from this server fetches them as it loads
   (GET /api/archetypes), so its skirmish rolls follow them too. */
'use strict';
const Rules = require('./rules.js');
const C = Rules.C, R = Rules.R;

const TACTICS = ['laststand', 'wave', 'guerillas'];

/* What an admin may set, checked before anything is kept: the numbers in range,
   every unit or group named one this army has, every doctrine one there is.
   Null for a good one, else what is wrong with it. */
function check(id, u) {
  const base = C.unifiedArchetype(id, true);
  if (!base) return 'there is no personality ' + id;
  if (!u || typeof u !== 'object') return 'nothing to save';
  const f = base.faction || 'pmc', list = R.listFor(f);
  const keys = new Set(list.map((p) => p.key)), groups = new Set(list.map((p) => p.group));
  const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
  if (u.name != null && (typeof u.name !== 'string' || !u.name.trim() || u.name.length > 60)) return 'the name must be 1-60 characters';
  if (u.names != null && (!Array.isArray(u.names) || !u.names.length || u.names.some((n) => typeof n !== 'string' || !n.trim() || n.length > 60))) return 'company names must be a list of names';
  const force = u.force || {};
  if (force.tier != null && [-1, 0, 1].indexOf(force.tier) < 0) return 'the tier preference is -1, 0 or 1';
  if (force.hulls != null) {
    const h = force.hulls;
    if (typeof h !== 'object' || (h.min != null && !num(h.min, 0, 3)) || (h.max != null && !num(h.max, 0, 3))) return 'hulls are 0-3 a Priority Level';
    if (h.min != null && h.max != null && h.min > h.max) return 'the fewest hulls is more than the most';
  }
  if (force.weights != null) {
    if (typeof force.weights !== 'object' || Array.isArray(force.weights)) return 'the weights must be a list';
    for (const k of Object.keys(force.weights)) {
      if (!keys.has(k) && !groups.has(k)) return k + ' is not a unit or group of this army';
      const v = force.weights[k];
      const ok = num(v, 0, 100) || (Array.isArray(v) && v.length >= 1 && v.length <= 2 && num(v[0], 0, 100) && (v[1] == null || (num(v[1], 0, 9) && Math.round(v[1]) === v[1])));
      if (!ok) return k + ': a weight is 0-100, and a limit a whole number 0-9';
    }
  }
  const battle = u.battle || {};
  if (battle.temper != null && !(num(battle.temper, -3, 3) && Math.round(battle.temper) === battle.temper)) return 'the temper is a whole number -3 to 3';
  if (battle.tactics != null) {
    for (const role of Object.keys(battle.tactics)) {
      if (['open', 'attack', 'defend'].indexOf(role) < 0) return 'tactics are for open, attack and defend';
      const t = battle.tactics[role];
      if (!(Array.isArray(t) ? t : [t]).every((x) => TACTICS.indexOf(x) >= 0)) return 'a tactic is Last Stand, Human Wave or Guerillas';
    }
  }
  const doc = u.doctrines || {};
  for (const k of ['shortlist']) {
    if (doc[k] != null && (!Array.isArray(doc[k]) || doc[k].some((d) => !C.doctrine(d)))) return 'the ' + k + ' names a doctrine there is not';
  }
  // ---- the Advanced fields ----
  const isKey = (k) => keys.has(k), isGroup = (g) => groups.has(g), bool = (v) => v == null || typeof v === 'boolean';
  const keyList = (v, nested) => v == null || (Array.isArray(v) && v.every((k) => (nested && Array.isArray(k)) ? k.every(isKey) : isKey(k)));
  if (u.blurb != null && (typeof u.blurb !== 'string' || u.blurb.length > 300)) return 'the blurb is up to 300 characters';
  if (doc.fixedAt != null && (typeof doc.fixedAt !== 'object' || Object.keys(doc.fixedAt).some((t) => !/^[1-5]$/.test(t) || !C.doctrine(doc.fixedAt[t])))) return 'doctrines.fixedAt is { Tier: doctrine }';
  if (doc.stages != null && (!Array.isArray(doc.stages) || doc.stages.some((st) => !Array.isArray(st) || st.some((d) => !C.doctrine(d))))) return 'doctrines.stages is a list of lists of doctrines';
  if (!bool(doc.random)) return 'doctrines.random is true or false';
  for (const k of ['riders']) if (force[k] != null && (!Array.isArray(force[k]) || !force[k].every(isGroup))) return 'force.' + k + ' names a group this army does not have';
  if (!bool(force.machineMinded)) return 'force.machineMinded is true or false';
  if (force.machinesMax != null && !num(force.machinesMax, 0, 9)) return 'force.machinesMax is 0-9';
  const camp = u.campaign || {}, found = camp.found || {};
  if (!keyList(found.t1) || !keyList(found.t2, true) || !keyList(found.hulls)) return 'the founding units name a unit this army does not have';
  if (found.hullCount != null && !num(found.hullCount, 0, 6)) return 'campaign.found.hullCount is 0-6';
  if (!bool(found.free) || !bool(camp.honourFirst) || !bool(camp.lean)) return 'free, honourFirst and lean are true or false';
  if (camp.spend != null && ['promote', 'honours', 'recruit', 'machines'].indexOf(camp.spend) < 0) return 'campaign.spend is promote, honours, recruit or machines';
  if (camp.leanSize != null && !num(camp.leanSize, 6, 60)) return 'campaign.leanSize is 6-60';
  return null;
}

function create(opts) {
  const db = opts.db, log = opts.log || function () { };
  let rows = [];
  function changes() { const m = {}; rows.forEach((r) => { m[r.id] = r.data; }); return m; }
  function load() {
    rows = db ? db.archetypes() : [];
    C.applyArchetypeChanges(changes());
    return rows.length;
  }
  /* A whole personality from the editor: checked, then rolled at every Tier with it in
     force (a list that cannot make an army is refused), and kept as its difference. */
  function save(id, nested, by, at) {
    const why = check(id, nested);
    if (why) return { ok: false, why: why };
    const change = C.archetypeChange(id, nested);
    const trial = Object.assign(changes(), {}); trial[id] = change;
    const f = (C.unifiedArchetype(id, true) || {}).faction || 'pmc';
    let bad = null;
    C.withArchetypeChanges(trial, () => {
      for (let t = 1; t <= 5 && !bad; t++) for (let pl = 1; pl <= 3 && !bad; pl++) {
        try { R.rollArmy(t, pl, null, f, id); } catch (e) { bad = 'it cannot roll a force at Tier ' + t + ', PL' + pl + ': ' + e.message; }
      }
    });
    if (bad) return { ok: false, why: bad };
    if (Object.keys(change).length) db.putArchetype(id, change, at || Date.now(), by);
    else db.dropArchetype(id);
    load();
    log('archetype ' + id + ' changed by ' + (by || '?'));
    return { ok: true, change: change, version: C.archetypeVersion() };
  }
  function reset(id, by) {
    db.dropArchetype(id);
    load();
    log('archetype ' + id + ' reset by ' + (by || '?'));
    return { ok: true, version: C.archetypeVersion() };
  }
  function list() {
    return { changes: changes(), updated: rows.map((r) => ({ id: r.id, updated: r.updated, by: r.by })), version: C.archetypeVersion() };
  }
  return { load: load, save: save, reset: reset, list: list, check: check };
}

module.exports = { create: create, check: check };
