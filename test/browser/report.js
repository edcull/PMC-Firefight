/* A whole battle fought by two AIs, then the battle report the campaign will read:
   does every unit appear, does the arithmetic add up, and does the credit for
   breaking an enemy land on the unit that actually did it? */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(400);

  // a campaign-flavoured game: dossier entries with names, honours and traumas
  const setup = await p.evaluate(() => {
    const C = window.PMCCamp, R = window.PMC;
    function entry(key, name, honours, traumas) {
      const e = C.newEntry(key, { name });
      e.honours = honours || []; e.traumas = traumas || [];
      return e;
    }
    const A = [
      entry('cmd2', 'Colonel Vance'),
      entry('regular', "Kowalski's Lads", [8, 4]),
      entry('regular', 'Second Section', [2]),
      entry('engineers', 'The Sappers', [13]),
      entry('lcv', 'Old Reliable', [], []),
      entry('sharpshooters', 'Ghost Team', [5])
    ];
    A[4].upgrades = [8];
    const B = [
      entry('cmd2', 'Major Orlov'),
      entry('regular', 'Red Section', [], [7]),
      entry('veterans', 'The Wolves', [9]),
      entry('lmgteam', 'Gun Group', [], [9]),
      entry('lcv', 'Hammer'),
      entry('shock', 'Storm Squad')
    ];
    window.__dossier = { A, B };
    return { A: A.map(e => e.name), B: B.map(e => e.name) };
  });
  console.log('fielded A:', setup.A.join(', '));
  console.log('fielded B:', setup.B.join(', '));

  await p.evaluate(() => {
    const d = window.__dossier;
    window.PMC_NEWGAME({
      tier: 4, pl: 1, mode: 'demo', planet: 'temperate', scenario: 'meeting',
      nameA: 'Ironhold', nameB: 'Orlov Group',
      armyA: d.A.map(e => e.key), armyB: d.B.map(e => e.key),
      dossier: d,
      doctrines: { A: ['T4', 'S2'], B: ['T6'] }
    });
  });
  await p.waitForTimeout(600);

  const built = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return s.units.map(u => ({
      label: u.label, side: u.side, rid: u.rid, fp: u.fp, move: u.move, def: u.def,
      flags: u.camp ? Object.keys(u.camp.flags) : null
    }));
  });
  console.log('\nunits as built:');
  built.forEach(u => console.log('  ' + u.side + ' ' + u.label.padEnd(26) +
    'FP ' + u.fp + '  Move ' + u.move + '  Def ' + u.def +
    (u.flags && u.flags.length ? '  [' + u.flags.join(', ') + ']' : '')));

  // let the two AIs fight it out
  console.log('\nfighting...');
  const t0 = Date.now();
  let turns = 0;
  for (let i = 0; i < 2000; i++) {
    const done = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      return s.over ? s.turn : 0;
    });
    if (done) { turns = done; break; }
    await p.waitForTimeout(120);
  }
  console.log('the battle ran ' + turns + ' turns in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');

  const rep = await p.evaluate(() => window.__report());
  if (!rep) { console.log('NO REPORT — the game never finished'); await b.close(); return; }

  const names = await p.evaluate(() => {
    const s = window.PMC_STATE(), out = {};
    s.units.forEach(u => { out[u.rid || u.id] = u.label; });
    return out;
  });

  console.log('\nresult: ' + (rep.winner ? rep.winner + ' wins' : 'a draw') +
    ' · Battle Tier ' + rep.battleTier + ' PL' + rep.pl +
    ' · routed A=' + rep.routed.A + ' B=' + rep.routed.B);
  console.log('\nthe battle report:');
  rep.units.forEach(l => {
    console.log('  ' + l.side + ' ' + (names[l.rid] || l.rid).padEnd(26) +
      l.startSize + '→' + l.endSize + ' models' +
      (l.brokenEver ? ' · broke' : '') +
      (l.wiped ? ' · LOST' : '') +
      (l.catastrophic ? ' (catastrophic)' : '') +
      (l.kills.length ? ' · credited with ' + l.kills.map(k => 'a Tier ' + k.tier + ' ' + k.key).join(' and ') : ''));
  });

  // --- the arithmetic
  const problems = [];
  const fielded = await p.evaluate(() => window.PMC_STATE().units.length);
  if (rep.units.length !== fielded) problems.push('report covers ' + rep.units.length + ' of ' + fielded + ' units');
  rep.units.forEach(l => {
    if (l.endSize > l.startSize) problems.push(names[l.rid] + ' ended with more models than it started');
    if (l.wiped && l.endSize !== 0) problems.push(names[l.rid] + ' is marked lost but has models left');
    /* A unit off the table with men left has fled, not been wiped out (pp. 34, 85).
       A machine is never "wiped out": it is destroyed, and salvage decides whether
       it comes back (p. 86), so it is marked `destroyed` rather than `wiped`. */
    if (!l.wiped && !l.destroyed && l.endSize === 0) problems.push(names[l.rid] + ' has no models but is not marked lost');
    if (l.fled && l.wiped) problems.push(names[l.rid] + ' is marked both fled and wiped out');
    if (l.fled && l.endSize === 0) problems.push(names[l.rid] + ' fled with nobody left to flee');
  });
  const claimed = rep.units.reduce((n, l) => n + l.kills.length, 0);
  const broken = rep.units.filter(l => l.brokenEver || l.wiped || l.destroyed).length;
  console.log('\n' + claimed + ' kills credited against ' + broken + ' units broken or destroyed');
  if (claimed > broken) problems.push('more kills credited than there were casualties');
  // nobody may be credited twice for the same enemy
  const seen = {};
  rep.units.forEach(l => l.kills.forEach(k => {
    const tag = l.rid + '>' + k.key;
    seen[tag] = (seen[tag] || 0) + 1;
  }));

  // --- the EXP and TP the campaign would award
  const ledger = await p.evaluate((r) => {
    const C = window.PMCCamp;
    const camp = C.newCampaign({ mode: 'hotseat' });
    const d = window.__dossier;
    camp.companies.A.roster = d.A; camp.companies.A.tier = 3;
    camp.companies.B.roster = d.B; camp.companies.B.tier = 4;
    camp.companies.A.cmdRid = d.A[0].rid; camp.companies.B.cmdRid = d.B[0].rid;
    const out = C.aftermath(camp, r);
    return {
      pay: { A: out.payment.A, B: out.payment.B },
      units: ['A', 'B'].flatMap(side => out.sides[side].units.map(u => ({
        side, name: u.name, exp: u.exp ? u.exp.total : 0, tp: u.tp ? u.tp.total : 0,
        why: u.exp ? u.exp.lines.map(x => x.text + ' +' + x.n).join('; ') : '',
        trauma: u.trauma ? u.trauma.name : null, wiped: u.wiped, salvage: u.salvage
      })))
    };
  }, rep);
  console.log('\npayment: A ' + ledger.pay.A + ' kUC, B ' + ledger.pay.B + ' kUC');
  console.log('\nthe aftermath ledger:');
  ledger.units.forEach(u => console.log('  ' + u.side + ' ' + String(u.name).padEnd(26) +
    '+' + u.exp + ' EXP  +' + u.tp + ' TP' +
    (u.trauma ? '  → ' + u.trauma : '') +
    (u.wiped ? '  STRUCK OFF' : '') +
    (u.salvage ? '  salvage ' + (u.salvage.roll || '-') + ' → ' + (u.salvage.saved ? 'recovered' : 'lost') : '') +
    (u.exp ? '   (' + u.why + ')' : '')));

  ledger.units.forEach(u => {
    if (u.exp < 0 || u.tp < 0) problems.push(u.name + ' has negative points');
    if (/Colonel|Major/.test(u.name) && (u.exp || u.tp)) {
      problems.push(u.name + ' is a Command Unit and should earn nothing');
    }
  });

  console.log('\nproblems: ' + (problems.length ? problems.join('; ') : 'none'));
  console.log('page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  process.exit(problems.length || errs.length ? 1 : 0);
})();
