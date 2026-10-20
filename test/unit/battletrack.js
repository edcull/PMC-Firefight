/* Debug tracking (src/rules/battletrack.js): a campaign raised with it has its
   battles tracked turn by turn — the table once, then every unit's place, men,
   status and cover, and each objective's holder, as deployed, as each turn's
   activations are done and at the end — kept on the campaign's line for its last ten battles, exported
   with it, and read by scripts/balance/tracks.js. A campaign without it keeps
   no such thing. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { R, C, Engine } = require('../../server/rules.js');
const BT = require('../../src/rules/battletrack.js');
const DB = require('../../server/db.js');
const Admin = require('../../server/admin.js');
let seed = 11;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

function battle(track) {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'secure', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'dense', campaign: true, terrainSetup: 'auto', track: track });
  for (let g = 0; g < 20000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e;
}

console.log('\nA tracked battle has its table and every turn on its report');
const e = battle(true), rep = e.report();
(function () {
  const t = rep && rep.track;
  ok('the battle is over, with a track', e.over() && !!t);
  ok('the table once: its terrain and objectives', t.table.terrain.length === e.state().terrain.length && t.table.objectives.length === e.state().objectives.length &&
    t.table.w > 0 && t.table.scenario === 'secure');
  const starts = t.turns.filter((s) => s.when === 'turn');
  ok('a look as deployed, first', t.turns[0].when === 'deploy' && t.turns[0].turn === 1);
  // (the last turn's, unless the battle ended before its Rally phase)
  ok('a look as each turn’s activations are done', starts.length >= rep.turns - 1 && starts.length <= rep.turns && starts.every((s, i) => s.turn === i + 1), starts.length + ' of ' + rep.turns);
  ok('...and one at the end', t.turns[t.turns.length - 1].when === 'end');
  const u = starts[0].units[0];
  ok('each unit: side, kind, place, men, status, ground and cover', !!u && /^[AB]$/.test(u.side) && !!u.key && typeof u.x === 'number' && typeof u.y === 'number' &&
    typeof u.models === 'number' && !!u.st && !!u.ground && typeof u.cover === 'number');
  ok('both sides on the table at the start', starts[0].units.some((x) => x.side === 'A') && starts[0].units.some((x) => x.side === 'B'));
  ok('each objective’s holder', starts.every((s) => s.holders.length === t.table.objectives.length && s.holders.every((h) => h === null || h === 'A' || h === 'B')));
  const f = BT.flip(t);
  ok('turned round for the other side', f.turns[1].units[0].side !== t.turns[1].units[0].side && f.turns[1].units.length === t.turns[1].units.length);
})();

console.log('\nAn untracked battle keeps none');
(function () {
  const r2 = battle(false).report();
  ok('no track on the report', r2 && !r2.track);
})();

console.log('\nA campaign keeps the track for its last ten battles');
const camp = C.newCampaign({ mode: 'solo', nameA: 'Ours', rivals: 1 });
(function () {
  C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  // the player's side (A) as a player would have had it, against the computer's
  const stats = { A: Object.assign({}, rep.stats.A, { ai: false }), B: rep.stats.B };
  for (let i = 0; i < 12; i++) C.aftermath(camp, Object.assign({}, rep, { stats: stats, units: [], casualties: [] }), {});
  const lines = camp.log.slice(-12);
  ok('the latest line has it', !!lines[11].track && lines[11].track.turns.length === rep.track.turns.length);
  ok('ten lines keep it, the older ones lose it', camp.log.filter((l) => l.track).length === 10 && !lines[0].track && !lines[1].track && !!lines[2].track);
  ok('...their statistics kept', !!lines[0].stats);
})();

console.log('\nExported with the campaign, and read out by tracks.js');
(function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-track-'));
  const db = DB.open(path.join(dir, 'pmc.db'));
  const uid = db.addUser({ name: 'Ash', pass: 'x', pub: 'p1', created: Date.now() });
  db.addCampaign({ owner: uid, kind: 'solo', name: 'Tracked', turn: 3, at: Date.now(), state: JSON.parse(JSON.stringify(camp)) });
  const out = Admin.exportCampaigns(db, 'Tracked');
  const c = out.campaigns[0];
  ok('the battles exported carry their tracks', c.battles.filter((b) => b.track).length === 10);
  const file = path.join(dir, 'export.json');
  fs.writeFileSync(file, JSON.stringify(out));
  const txt = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/balance/tracks.js'), file], { encoding: 'utf8' });
  ok('tracks.js reads them, the player beside the computer', /10 tracked battles/.test(txt) && /in cover/.test(txt) && /nearest enemy/.test(txt), txt.split('\n')[0]);
  db.close();
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
