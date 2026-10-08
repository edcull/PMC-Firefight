/* The personalities as an admin has changed them (server/archetypes.js): kept in
   the database as their difference from the default, laid over the defaults at
   start-up, saved and reset only by an admin, checked before they are kept, and
   handed to any page that asks. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const DB = require('../../server/db.js');
const Auth = require('../../server/auth.js');
const AdminApi = require('../../server/adminapi.js');
const Archetypes = require('../../server/archetypes.js');
const App = require('../../server/app.js');
const { C, R } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-archetypes-'));
  const file = path.join(dir, 'pmc.db');
  let db = DB.open(file);
  const mailer = { live: false, link: () => '', send: () => Promise.resolve({ ok: true }) };
  const auth = Auth.create({ db: db, mailer: mailer });
  await auth.register('Boss', 'password boss', '1'); await auth.register('Ash', 'password ash', '1');
  const boss = db.userByName('Boss'), ash = db.userByName('Ash');
  db.activate(boss.id); db.activate(ash.id); db.setAdmin(boss.id, true);
  const me = { userId: boss.id, name: 'Boss' }, them = { userId: ash.id, name: 'Ash' };
  let arch = Archetypes.create({ db: db });
  arch.load();
  const api = AdminApi.create({ db: db, auth: auth, archetypes: arch });

  console.log('\nSaving a personality');
  const u = C.unifiedArchetype('armour');
  u.force.tier = 1; u.battle.temper = -2; u.force.weights.sam = 0;
  ok('a player who is not an admin may not', (await api.handle(them, 'archetype-save', { id: 'armour', data: u })).code === 403);
  let r = await api.handle(me, 'archetype-save', { id: 'armour', data: u });
  ok('an admin may: saved', r.ok, r.why || '');
  ok('...as its difference from the default', r.ok && Object.keys(r.change).sort().join(',') === 'battle,force', JSON.stringify(r.change || {}).slice(0, 120));
  ok('...in force at once', C.archetype('armour').tier === 1 && C.archetype('armour').temper === -2);
  ok('...and kept in the database', db.archetypes().length === 1 && db.archetypes()[0].by === 'Boss');

  console.log('\nChecked before it is kept');
  const bad = (f) => { const x = C.unifiedArchetype('armour'); f(x); return api.handle(me, 'archetype-save', { id: 'armour', data: x }); };
  ok('a tier preference out of range', !(await bad((x) => { x.force.tier = 2; })).ok);
  ok('a weight out of range', !(await bad((x) => { x.force.weights.bats = 11; })).ok);
  ok('a unit the army does not have', !(await bad((x) => { x.force.weights.rguard = 5; })).ok);
  ok('more fewest hulls than most', !(await bad((x) => { x.force.hulls = { min: 3, max: 1 }; })).ok);
  ok('a doctrine there is not', !(await bad((x) => { x.doctrines.shortlist = ['ZZ9']; })).ok);
  ok('a tactic there is not', !(await bad((x) => { x.battle.tactics = { open: 'charge' }; })).ok);
  ok('a spending style there is not', !(await bad((x) => { x.campaign.spend = 'splurge'; })).ok);
  ok('a founding unit the army does not have', !(await bad((x) => { x.campaign.found.t1 = ['rguard']; })).ok);
  ok('a staged doctrine there is not', !(await bad((x) => { x.doctrines.stages = [['ZZ1']]; })).ok);
  ok('a favourite hull group the army does not have', !(await bad((x) => { x.force.favourites = ['Rebel aviation']; })).ok);
  ok('...but every default passes', ['pmc', 'rebel', 'bugs', 'xeno'].every((f) => C.archetypesFor(f).every((x) => !Archetypes.check(x.id, C.unifiedArchetype(x.id, true)))));
  ok('...and nothing of it was kept', C.archetype('armour').tier === 1 && db.archetypes().length === 1);

  console.log('\nThe server starting again');
  C.applyArchetypeChanges({});
  db.close(); db = DB.open(file);
  arch = Archetypes.create({ db: db });
  ok('the change is laid over the default again', arch.load() === 1 && C.archetype('armour').tier === 1);

  console.log('\nHanded to a page');
  const handle = App.create({ campaigns: { list: () => [] }, lobby: { rooms: new Map(), players: new Map() }, serve: (q, s) => { s.writeHead(404); s.end(); }, archetypes: arch });
  const srv = http.createServer(handle);
  await new Promise((res) => srv.listen(0, res));
  const body = await new Promise((res) => http.get('http://127.0.0.1:' + srv.address().port + '/api/archetypes', (q) => { let t = ''; q.on('data', (c) => { t += c; }); q.on('end', () => res(JSON.parse(t))); }));
  srv.close();
  ok('GET /api/archetypes has the changes', body.changes && body.changes.armour && body.changes.armour.force.tier === 1, JSON.stringify(body).slice(0, 120));

  console.log('\nReset');
  const api2 = AdminApi.create({ db: db, auth: auth, archetypes: arch });
  r = await api2.handle(me, 'archetype-reset', { id: 'armour' });
  ok('back to its default, and nothing kept', r.ok && C.archetype('armour').tier === 0 && db.archetypes().length === 0);
  ok('...and it still rolls', R.checkArmy(R.rollArmy(3, 2, null, 'pmc', 'armour'), 3, 2).ok);

  db.close();
  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
