/* A revolt played through the interface: raise it, walk a Path, take a contract,
   fight the battle and read the aftermath — then check the screens speak the
   revolt's own language throughout (Influence Points, Paths, First Among Equals)
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

  /* ---------------------------------------------------------- raising it */
  console.log('\nRaising a revolt');
  await click(p, '#btn-campaign');
  await p.evaluate(() => {
    document.getElementById('camp-faction').value = 'rebel';
  });
  await clickText(p, '(?:RAISE|Raise) THE FORCE|Raise the force');
  // the revolt is named on the founding screen now, beside its colours
  await p.evaluate(() => { document.getElementById('found-name').value = 'The Free Colonies'; });
  let txt = await body(p);
  check('the founding screen speaks for a revolt', await p.evaluate(() => /the revolt/i.test(document.querySelector('#camp-body .found-units .muster-head').textContent)));
  check('...and asks what the revolt calls itself',
    await p.evaluate(() => !!document.getElementById('found-name')));
  check('...and for the colours it fights in',
    await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); return document.querySelectorAll('#camp-body [data-campcolour]').length > 1; }));
  // the free First Among Equals is promised once the list is legal: see "the list is a legal revolt" below
  check('...and offers Paths rather than doctrines',
    /choose a path/i.test(txt) && /path of the hero/i.test(await p.evaluate(() =>
      document.querySelector('#camp-body .cmodal[data-modal="doctrine"]').textContent)));
  check('...eighteen of them', await p.evaluate(() =>
    document.querySelectorAll('#camp-body [data-doc]').length) === 18);

  const rebelOnly = await p.evaluate(() =>
    [...document.querySelectorAll('#camp-body [data-add]')]
      .map(b => b.getAttribute('data-add'))
      .every(k => window.PMC.profile(k).faction === 'rebel'));
  check('the list on offer is all Rebel', rebelOnly);

  for (const k of ['rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rciv', 'rmilitia', 'rminers']) {
    if (!await click(p, `#camp-body button[data-add="${k}"]`)) problems.push('could not add ' + k);
  }
  await click(p, '#camp-body [data-doc="H1"]');
  const sign = await p.evaluate(() => { const b = document.getElementById('found-sign'); return { title: b.title, off: b.disabled }; });
  check('the list is a legal revolt', /ready\. the first among equals/i.test(sign.title) && !sign.off, sign.title);
  await shot(p, 'rebel-found.png');
  check('the banner can be raised', await clickText(p, '(?:RAISE|Raise) THE BANNER|Raise the banner'));

  /* ---------------------------------------------------------------- hub */
  console.log('\nThe hub');
  txt = await body(p);
  check('the revolt is on the books', /The Free Colonies/.test(txt));
  check('...paid in Influence Points', /\bIP\b/.test(txt) && !/\bkUC\b/.test(txt),
    /kUC/.test(txt) ? 'kUC still appears: ' + (txt.split('\n').filter(l => /kUC/.test(l))[0] || '')
      : (txt.match(/\d+ IP/) || [])[0]);
  check('...led by a First Among Equals', await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get().companies.A;
    return window.PMC.profile(window.PMCCamp.byRid(c, c.cmdRid).key).group;
  }) === 'First Among Equals');
  // who else is on the world is in the campaign's window
  const foes = await p.evaluate(() => { const b = document.querySelector('#camp-body [data-kind="rivals"]'); return b ? b.textContent : ''; });
  check('...and faces somebody', /forces|Rival|against/.test(foes), foes);
  await shot(p, 'rebel-hub.png');

  const rival = await p.evaluate(() => {
    const B = window.PMC_CAMPAIGN.get().companies.B;
    return { name: B.name, faction: B.faction };
  });
  check('the opposition is a force of its own', !!rival.name, rival.name + ' (' + rival.faction + ')');

  /* ------------------------------------------------------------ the Paths */
  console.log('\nPaths');
  await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    c.companies.A.tier = 3;                    // three Path slots to play with
    window.PMC_CAMPAIGN.set(c);
  });
  await p.waitForTimeout(200);
  // every pick drops back to the hub, so the screen is reopened between them
  async function openPaths() {
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('#camp-body button')]
        .find(x => /choose a path/i.test(x.textContent));
      if (b) b.click();
    });
    await p.waitForTimeout(250);
  }
  await openPaths();
  txt = await body(p);
  check('the Path screen is grouped the book\'s way',
    /paths of the hero/i.test(txt) && /paths of the villain/i.test(txt) && /paths of the prophet/i.test(txt));
  check('...and says how many of each group are held', /\d of 2/i.test(txt),
    (txt.match(/\d of 2/i) || [])[0]);
  await click(p, '#camp-body [data-take="H2"]');
  const held = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.doctrines.slice());
  check('a second Hero Path can be taken', held.length === 2, held.join(' '));
  await openPaths();
  await shot(p, 'rebel-paths.png');
  const blocked = await p.evaluate(() => {
    const b = document.querySelector('#camp-body [data-take="H3"]');
    return b ? b.disabled : null;
  });
  check('...but never a third', blocked === true);
  await click(p, '#camp-body [data-take="V1"]');
  check('another group is still open',
    (await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.doctrines.length)) === 3);

  /* --------------------------------------------------------- the contract */
  console.log('\nA contract');
  await p.evaluate(() => { const b = document.querySelector('#camp-body .dosbar [data-go="roster"]'); if (b) b.click(); });   // the hub opens on the dossier
  await p.waitForTimeout(200);
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
  await clickText(p, '[Ff][Ii][Ll][Ll] [Tt][Hh][Ee] [Ll][Ii][Ss][Tt]');
  txt = await body(p);
  check('the list filled legally', /A legal Battle Tier/.test(txt), (txt.match(/\d+ \/ \d+/) || [])[0]);
  await shot(p, 'rebel-contract.png');
  check('the field can be taken', await clickText(p, '[Tt][Aa][Kk][Ee] [Tt][Hh][Ee] [Ff][Ii][Ee][Ll][Dd]'));
  await p.waitForTimeout(900);

  /* ----------------------------------------------------------- the battle */
  console.log('\nThe battle');
  const onTable = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      factions: [...new Set(s.units.map(u => u.faction))].sort().join('+'),
      docs: (s.doctrines && s.doctrines.A) || [],
      leaders: s.units.filter(u => u.side === 'A' && u.group === 'First Among Equals').length,
      mined: !!s.mined
    };
  });
  check('the revolt is on the table', /rebel/.test(onTable.factions), onTable.factions);
  check('...carrying its Paths', onTable.docs.length === 3, onTable.docs.join(' '));
  check('...and led from the front', onTable.leaders >= 1, onTable.leaders + ' leader(s)');

  for (let i = 0; i < 14; i++) { await drain(p); await p.waitForTimeout(120); }
  await p.evaluate(() => {
    const b = document.querySelector('button[data-act="autodeploy"]');
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  for (let i = 0; i < 8; i++) { await drain(p); await p.waitForTimeout(110); }
  /* Rather than play it by hand, both sides go to the AI — before Start, not
     after it. Handed over once the battle is under way, a revolt that wins the
     initiative is left waiting on a player who is no longer there: nothing
     asks the AI to act and the battle sits at turn 1 for good. */
  const started = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.cfg.aiSides = ['A', 'B'];
    const b = document.querySelector('button[data-act="start"]');
    if (b) b.click();
    return s.phase;
  });
  check('the battle starts', started === 'battle', started);
  await p.waitForTimeout(600);

  // bounded: a battle that never ends fails the check below rather than hanging
  let over = null;
  const until = Date.now() + 120000;
  for (let i = 0; Date.now() < until; i++) {
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
  check('...and pays the revolt in Influence Points', /\+\d+ IP/.test(txt),
    (txt.match(/\+\d+ (IP|kUC)/) || [])[0]);
  check('...and says where the other two forces were', /elsewhere on the world/i.test(txt),
    (txt.split('\n').filter(l => /fought their own battle/.test(l))[0] || 'no line'));
  await shot(p, 'rebel-aftermath.png');
  const after = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get(), A = c.companies.A;
    return {
      turn: c.turn, ip: A.kUC, roster: A.roster.length,
      exp: A.roster.reduce((n, e) => n + e.exp, 0),
      cmdExp: window.PMCCamp.byRid(A, A.cmdRid).exp
    };
  });
  check('the campaign turn advanced', after.turn === 1, 'turn ' + after.turn);
  check('the revolt was paid', after.ip >= 0, after.ip + ' IP');
  check('units earned experience', after.exp > 0, after.exp + ' EXP across the roster');
  check('...but the leader never does', after.cmdExp === 0, after.cmdExp + ' EXP');

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
  check('the hub came back', await p.evaluate(() => !!document.querySelector('#camp-body .cpan-A .hubbar')),
    (await body(p)).split('\n').slice(0, 2).join(' | '));
  await clickText(p, '^Dossier$');
  txt = await body(p);
  check('the dossier opened', await p.evaluate(() => !!document.querySelector('#camp-body .cdos')));
  check('the dossier speaks Influence Points', /IP/.test(txt) && !/kUC/.test(txt));
  const badge = await p.evaluate(() => document.querySelector('#camp-body .tierbadge').title);
  check('...and calls it a Revolt Tier', /revolt tier/i.test(badge), badge);
  await shot(p, 'rebel-roster.png');

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
  check('the revolt came back', !!back && back.name === 'The Free Colonies');
  check('...still a Rebel force', back && back.faction === 'rebel');
  check('...at the same turn', back && back.turn === after.turn, back ? 'turn ' + back.turn : '');
  check('...with its Paths intact', back && back.paths.length === 3, back ? back.paths.join(' ') : '');
  check('no native dialog was ever raised', dialogs === 0, dialogs + ' raised');

  console.log('\nproblems: ' + (problems.length ? problems.join(' | ') : 'none'));
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'none'));
  console.log('screens: ' + shots.join(', '));
  await b.close();
  process.exit(problems.length || errs.length ? 1 : 0);
})();
