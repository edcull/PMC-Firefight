/* A Xenotripod tribe played through the interface: claim a territory, take an
   Advancement, fight a contract with both sides on AI, read the aftermath —
   check the screens speak Territorial Points / Tribe Advancements / Alpha squads
   and that the dossier survives a reload. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

const shots = [];
async function shot(p, name) {
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOTS, name) });
  shots.push(name);
}
async function body(p) { return p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText); }
async function click(p, sel) {
  const hit = await p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, sel);
  await p.waitForTimeout(220);
  return hit;
}
async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(220);
  return hit;
}
async function drain(p) {
  await p.evaluate(() => {
    const r = document.getElementById('resolution');
    if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // native dialogs never show inside the published frame, so any use is a bug
  let dialogs = 0;
  p.on('dialog', async d => { dialogs++; await d.dismiss(); });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } });

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }

  /* ---------------------------------------------------------- claiming it */
  console.log('\nClaiming a territory');
  await click(p, '#btn-campaign');
  await p.evaluate(() => { document.getElementById('camp-faction').value = 'xeno'; });
  await clickText(p, '(?:RAISE|Raise) THE FORCE|Raise the force');
  await p.evaluate(() => { document.getElementById('found-name').value = 'The Ghadon Third'; });
  let txt = await body(p);
  check('the founding screen speaks for a tribe', await p.evaluate(() => /the tribe/i.test(document.querySelector('#camp-body .found-units .muster-head').textContent)));
  check('...offers Tribe Advancements', /starting tribe advancement/i.test(txt), (txt.match(/Starting [^\n]+/i) || [])[0]);
  check('...eighteen of them', await p.evaluate(() =>
    document.querySelectorAll('#camp-body [data-doc]').length) === 18);
  const xenoOnly = await p.evaluate(() =>
    [...document.querySelectorAll('#camp-body [data-add]')]
      .map(b => b.getAttribute('data-add'))
      .every(k => window.PMC.profile(k).faction === 'xeno'));
  check('the list on offer is all Xenotripod', xenoOnly);
  check('...with no Alphas for sale', await p.evaluate(() =>
    ![...document.querySelectorAll('#camp-body [data-add]')].some(b => window.PMC.profile(b.getAttribute('data-add')).alpha)));
  for (const k of ['xeps1', 'xeps1', 'xeps1', 'xeps1', 'xdelta1', 'xdelta1', 'xbeta2', 'xeps2']) {
    if (!await click(p, `#camp-body button[data-add="${k}"]`)) problems.push('could not add ' + k);
  }
  await click(p, '#camp-body [data-doc="XO6"]');
  txt = await body(p);
  check('the list is a legal tribe', /ready\. the alpha squad/i.test(txt), txt.split('\n').slice(-3)[0]);
  await shot(p, 'xeno-found.png');
  check('the ground can be claimed', await clickText(p, '(?:CLAIM|Claim) THE GROUND|Claim the ground'));

  /* ---------------------------------------------------------------- hub */
  console.log('\nThe hub');
  txt = await body(p);
  check('the tribe is on the books', /The Ghadon Third/.test(txt));
  check('...paid in Territorial Points', /TerP/.test(txt) && !/\bkUC\b/.test(txt),
    /kUC/.test(txt) ? 'kUC still appears: ' + (txt.split('\n').filter(l => /kUC/.test(l))[0] || '') : '');
  check('...led by an Alpha squad', await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get().companies.A;
    return !!window.PMC.profile(window.PMCCamp.byRid(c, c.cmdRid).key).alpha;
  }));
  await shot(p, 'xeno-hub.png');
  const rival = await p.evaluate(() => {
    const B = window.PMC_CAMPAIGN.get().companies.B;
    return { name: B.name, faction: B.faction };
  });
  check('the opposition is a force of its own', !!rival.name, rival.name + ' (' + rival.faction + ')');

  /* ------------------------------------------------------ the Advancements */
  console.log('\nAdvancements');
  await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    c.companies.A.tier = 3;
    window.PMC_CAMPAIGN.set(c);
  });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button')].find(x => /advancement/i.test(x.textContent));
    if (b) b.click();
  });
  await p.waitForTimeout(250);
  txt = await body(p);
  check('the Advancement screen is grouped the book\'s way',
    /social/i.test(txt) && /organisational/i.test(txt) && /technological/i.test(txt));
  await shot(p, 'xeno-advancements.png');
  await click(p, '#camp-body [data-take="XT3"]');
  const held = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.doctrines.slice());
  check('a second Advancement can be taken', held.length === 2, held.join(' '));
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button')].find(x => /advancement/i.test(x.textContent));
    if (b) b.click();
  });
  await p.waitForTimeout(250);
  await click(p, '#camp-body [data-take="XO3"]');
  check('...and a third', (await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.doctrines.length)) === 3);

  /* --------------------------------------------------------- the contract */
  console.log('\nA contract');
  await clickText(p, '^Contract$');
  await p.waitForTimeout(200);
  const offered = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('#camp-body .cpan-offer')];
    return { n: cards.length, leaks: cards.filter(k => /\d+ units|Their dossier/.test(k.textContent)).length };
  });
  check('contracts are offered, none showing a list',
    offered.n >= 2 && offered.n <= 6 && offered.leaks === 0,
    offered.n + ' offers, ' + offered.leaks + ' leaks');
  await p.evaluate(() => { document.querySelector('#camp-body [data-take-offer]').click(); });
  await p.waitForTimeout(250);
  txt = await body(p);
  check('a Battle Tier was rolled', /Battle Tier/.test(txt), txt.split('\n')[1]);
  check('a scenario was rolled',
    /Meeting engagement|Secure and control|Find and secure|Invasion|Demolish|Hostile takeover/.test(txt),
    (txt.match(/Meeting engagement|Secure and control|Find and secure|Invasion|Demolish|Hostile takeover/) || [])[0]);
  check('Foresighted Command offers a second scenario', /Foresighted Command/.test(txt),
    (txt.split('\n').filter(l => /Foresighted/.test(l))[0] || 'no line'));
  const before = await p.evaluate(() => document.getElementById('camp-body').innerText.match(/Scenario D6 \d — ([^.]+)\./)[1]);
  await click(p, '#camp-body [data-foresee]');
  const afterSwap = await p.evaluate(() => document.getElementById('camp-body').innerText.match(/Scenario D6 \d — ([^.]+)\./)[1]);
  check('...and the tribe can take it instead', /agreed/.test(txt) || before !== afterSwap,
    before + ' → ' + afterSwap);
  await clickText(p, '[Ff][Ii][Ll][Ll] [Tt][Hh][Ee] [Ll][Ii][Ss][Tt]');
  txt = await body(p);
  check('the list filled legally', /A legal Battle Tier/.test(txt), (txt.match(/\d+ \/ \d+/) || [])[0]);
  await shot(p, 'xeno-contract.png');
  check('the field can be taken', await clickText(p, '[Tt][Aa][Kk][Ee] [Tt][Hh][Ee] [Ff][Ii][Ee][Ll][Dd]'));
  await p.waitForTimeout(900);

  /* ----------------------------------------------------------- the battle */
  console.log('\nThe battle');
  const onTable = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      factions: [...new Set(s.units.map(u => u.faction))].sort().join('+'),
      docs: (s.doctrines && s.doctrines.A) || [],
      leaders: s.units.filter(u => u.side === 'A' && window.PMC.profile(u.key).alpha).length,
      mined: !!s.mined
    };
  });
  check('the tribe is on the table', /xeno/.test(onTable.factions), onTable.factions);
  check('...carrying its Advancements', onTable.docs.length === 3, onTable.docs.join(' '));
  check('...and led from the front', onTable.leaders >= 1, onTable.leaders + ' leader(s)');

  for (let i = 0; i < 14; i++) { await drain(p); await p.waitForTimeout(120); }
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="autodeploy"]');
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) { await drain(p); await p.waitForTimeout(110); }
  /* Rather than play it by hand, both sides go to the AI — before Start, not
     after: when the tribe won the initiative the game was already waiting on
     a player, and once the board went idle nothing asked the AI to act. */
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.cfg.aiSides = ['A', 'B'];
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
  });
  await p.waitForTimeout(600);

  // bounded: a battle that never ends fails the check below rather than hanging
  let over = null;
  const until = Date.now() + 120000;
  for (let i = 0; i < 3000 && Date.now() < until; i++) {
    over = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      return s && s.over ? { text: s.over.text, turn: s.turn } : null;
    });
    if (over) break;
    await p.waitForTimeout(110);
  }
  check('the battle reached a decision', !!over, over ? 'turn ' + over.turn + ': ' + over.text : 'still running');

  /* -------------------------------------------------------- the aftermath */
  console.log('\nThe aftermath');
  await p.waitForTimeout(1600);
  for (let i = 0; i < 10; i++) { await drain(p); await p.waitForTimeout(160); }
  await p.waitForTimeout(700);
  txt = await body(p);
  check('the aftermath screen opened', /aftermath|EXP/i.test(txt), txt.split('\n')[0]);
  // the revolt is paid in IP; a mercenary company fighting elsewhere is still paid in kUC
  check('...and pays the tribe in Territorial Points', /\+\d+ TerP/.test(txt),
    (txt.match(/\+\d+ (TerP|IP|kUC)/) || [])[0]);
  check('...recalculating territory when the scenario calls for it',
    !/Invasion|Demolish|Hostile takeover/.test(txt) || /Territorial recalculation/.test(txt) || !/won|lost/i.test(txt),
    (txt.split('\n').filter(l => /Territorial/.test(l))[0] || 'no line'));
  check('...and says where the other two forces were', /elsewhere on the world/i.test(txt),
    (txt.split('\n').filter(l => /fought their own battle/.test(l))[0] || 'no line'));
  check('...and who is coming next', /next:/i.test(txt),
    (txt.match(/Next: [^\n]+/i) || [])[0]);
  await shot(p, 'xeno-aftermath.png');
  const after = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get(), A = c.companies.A;
    return {
      turn: c.turn, ip: A.kUC, roster: A.roster.length,
      exp: A.roster.reduce((n, e) => n + e.exp, 0),
      cmdExp: window.PMCCamp.byRid(A, A.cmdRid).exp
    };
  });
  check('the campaign turn advanced', after.turn === 1, 'turn ' + after.turn);
  check('the tribe was paid', after.ip >= 0, after.ip + ' TerP');
  check('units earned experience', after.exp > 0, after.exp + ' EXP across the roster');
  check('...but the Alpha never does', after.cmdExp === 0, after.cmdExp + ' EXP');

  /* ------------------------------------------------------------- dossier */
  console.log('\nThe dossier');
  // walk back to the hub, whichever screen the aftermath left us on
  for (let i = 0; i < 8; i++) {
    txt = await body(p);
    if (/take a contract/i.test(txt)) break;
    if (!await click(p, '#camp-body [data-go="hub"]')) {
      if (!await clickText(p, '[Cc]ontinue|[Bb]ack|[Cc]lose|CONTINUE|BACK|CLOSE')) break;
    }
  }
  check('the hub came back', /\bcontract\b/i.test(await body(p)),
    (await body(p)).split('\n').slice(0, 2).join(' | '));
  await clickText(p, '^Dossier$');
  txt = await body(p);
  check('the dossier opened', /units on the books/i.test(txt), txt.split('\n')[1]);
  check('the dossier speaks Territorial Points', /TerP/.test(txt) && !/kUC/.test(txt));
  check('...and calls it a Tribe Tier', /tribe tier/i.test(txt), txt.split('\n')[1]);
  await shot(p, 'xeno-roster.png');

  /* -------------------------------------------------------------- reload */
  console.log('\nReloading the page');
  await p.reload();
  await p.waitForTimeout(900);
  await click(p, '#btn-campaign');
  const back = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return c ? { turn: c.turn, faction: c.companies.A.faction, name: c.companies.A.name,
      paths: c.companies.A.doctrines.slice() } : null;
  });
  check('the tribe came back', !!back && back.name === 'The Ghadon Third');
  check('...still a Xenotripod tribe', back && back.faction === 'xeno');
  check('...at the same turn', back && back.turn === after.turn, back ? 'turn ' + back.turn : '');
  check('...with its Advancements intact', back && back.paths.length === 3, back ? back.paths.join(' ') : '');
  check('no native dialog was ever raised', dialogs === 0, dialogs + ' raised');

  console.log('\nproblems: ' + (problems.length ? problems.join(' | ') : 'none'));
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  console.log('screens: ' + shots.join(', '));
  await b.close();
  process.exit(problems.length || errs.length ? 1 : 0);
})();
