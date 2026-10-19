/* A battle's statistics (src/rules/battlestats.js): read off the log onto the
   engine's battle report, kept on the campaign's line for the battle, and
   exported with the campaign from the server's command line (server/admin.js
   export-campaign), the player's side against the computer's added up. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { R, C, Engine } = require('../../server/rules.js');
const DB = require('../../server/db.js');
const Admin = require('../../server/admin.js');
let seed = 9;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

// a campaign battle fought to the end, the player's side (A) played by the computer too
function battle() {
  const e = Engine.create();
  e.start({ tier: 2, pl: 1, scenario: 'meeting', armyA: R.rollArmy(2, 1, null, 'pmc'), armyB: R.rollArmy(2, 1, null, 'rebel'),
    nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'demo', planet: 'sparse', campaign: true, terrainSetup: 'auto' });
  for (let g = 0; g < 20000 && !e.over(); g++) {
    const s = e.state();
    if (s.swapAsk) { e.intent(s.swapAsk.side, { k: 'swapdone' }); continue; }
    if (s.faceAsk) { e.intent(s.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (s.phase === 'deploy' || s.phase === 'terrain') { e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' }); continue; }
    if (!e.intent(s.activeSide || 'A', { k: 'step' }).ok) break;
  }
  return e;
}

console.log('\nThe battle report carries each side’s statistics');
const e = battle(), rep = e.report(), L = e.state().log;
(function () {
  const st = rep && rep.stats;
  ok('the battle is over and reported', e.over() && !!rep);
  ok('...with statistics for both sides', !!st && !!st.A && !!st.B);
  const shots = (s) => L.filter((l) => l.t === 'shoot' && (l.text || '').indexOf('[' + s + ']') >= 0 && /^[^[]*\[/.test(l.text) &&
    /\[(A|B)\]/.exec(l.text)[1] === s).length;
  ok('the shots counted are the log’s', st.A.shots === shots('A') && st.B.shots === shots('B'), st.A.shots + '/' + shots('A') + ', ' + st.B.shots + '/' + shots('B'));
  ok('...the units lost too', st.A.unitsLost === L.filter((l) => l.t === 'kill' && /\[A\]/.test(l.text || '')).length);
  ok('the outcome is folded in: one battle, its turns, who won', st.A.battles === 1 && st.A.turns === rep.turns &&
    st.A.wins === (rep.winner === 'A' ? 1 : 0) && st.B.wins === (rep.winner === 'B' ? 1 : 0));
  ok('...and who the computer ran', st.A.ai === true && st.B.ai === true);
})();

console.log('\nA campaign keeps them on the battle’s line');
(function () {
  const camp = C.newCampaign({ mode: 'solo', nameA: 'Ours', rivals: 1 });
  C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
  const report = Object.assign({}, rep, { units: [], casualties: [] });
  C.aftermath(camp, report, {});
  const line = camp.log[camp.log.length - 1];
  ok('the line for the battle has the statistics', !!line && !!line.stats && line.stats.A.shots === rep.stats.A.shots);
})();

console.log('\nThe server exports a campaign by name, with its battles against the computer added up');
(function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-stats-'));
  const db = DB.open(path.join(dir, 'pmc.db'));
  const uid = db.addUser({ name: 'Ash', pass: 'x', pub: 'p1', created: Date.now() });
  const st = (ai, shots, wins) => Object.assign({}, rep.stats.A, { ai: ai, shots: shots, wins: wins, battles: 1 });
  const line = (n, stats, extra) => Object.assign({ turn: n, scenario: 'secure', tier: 2, pl: 1, winner: 'A', against: 'Rivals', stats: stats }, extra || {});
  db.addCampaign({ owner: uid, kind: 'solo', name: 'Ash’s Company', turn: 3, at: Date.now(), state: {
    title: '4x', log: [
      line(1, { A: st(false, 20, 1), B: st(true, 10, 0) }),
      line(2, { A: st(false, 30, 1), B: st(true, 12, 0) }),
      line(3, null)                                           // an older battle, before the statistics were kept
    ]
  } });
  db.addCampaign({ owner: uid, kind: 'solo', name: 'Someone else', turn: 1, at: Date.now(), state: { log: [] } });
  const out = Admin.exportCampaigns(db, '4x');
  const c = out.campaigns[0];
  ok('found by its title, and only it', out.campaigns.length === 1 && c.name === 'Ash’s Company');
  ok('...or by its name', Admin.exportCampaigns(db, 'ash’s company').campaigns.length === 1);
  ok('every battle listed, the older one without statistics', c.battles.length === 3 && !c.battles[2].stats);
  ok('the battles against the computer counted', c.summary.againstAI === 3 && c.summary.withStats === 2);
  ok('the player’s side and the computer’s added up', c.summary.player.shots === 50 && c.summary.ai.shots === 22 &&
    c.summary.player.wins === 2 && c.summary.player.battles === 2);
  ok('the campaign itself comes whole', !!c.state && c.state.title === '4x');
  db.close();
})();

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
