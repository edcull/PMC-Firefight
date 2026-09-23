/* Hotseat, co-op and demo skirmishes build both forces before the battle: each
   side in turn (kind, name, colours, units), then the battlefield (scenario,
   world, terrain). A demo starts each side as a random kind of force with a
   rolled build. And on a page with no server behind it, the Multiplayer card
   is there but greyed out. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }
  const shown = (id) => p.evaluate((id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; }, id);
  const hot = () => p.evaluate(() => window.__hot());
  const next = async () => { await p.evaluate(() => document.getElementById('btn-start').click()); await p.waitForTimeout(250); };
  const setVal = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  const roll = () => p.evaluate(() => document.querySelector('[data-army="roll"]').click());
  const name = (v) => p.evaluate((v) => { document.getElementById('hot-name').value = v; }, v);
  const title = () => p.evaluate(() => document.getElementById('setup-title').textContent);

  console.log('\nThe menu');
  const multi = await p.evaluate(() => { const m = document.getElementById('btn-multi'); return { hidden: m.hidden, disabled: m.disabled, sub: m.innerText }; });
  check('Multiplayer is shown but disabled with no server', !multi.hidden && multi.disabled && /server/i.test(multi.sub), multi.sub.replace(/\s+/g, ' '));

  console.log('\nHotseat');
  await p.evaluate(() => window.PMC_SKIRMISH('hotseat'));
  await p.waitForTimeout(200);
  check('player 1 musters first', /^Player 1 — muster your force$/.test(await title()), await title());
  check('...with no battlefield choices yet', !(await shown('sel-scen')) && !(await shown('sel-planet')) && !(await shown('sel-op')));
  await next();
  check('...and cannot go on without a name and a legal force', (await hot()).step === 1);
  await roll(); await name('Task Force Ironhold');
  await next();
  let h = await hot();
  check('player 2 musters next', h.step === 2 && /^Player 2 — muster your force$/.test(await title()));
  check('...at player 1\'s Tier, which they cannot change', await p.evaluate(() => document.getElementById('sel-tier').disabled));
  check('...not in player 1\'s colour', await p.evaluate((c) => { const s = document.querySelector(`#colourpick [data-colour="${c}"]`); return s.disabled && !s.classList.contains('on'); }, h.sides[0].colour));
  await setVal('sel-faction', 'bugs');
  await roll(); await name('The Hive');
  // back and forward again keeps both forces
  await p.evaluate(() => document.getElementById('btn-hot-back').click()); await p.waitForTimeout(200);
  h = await hot();
  check('Back returns to player 1 with their force intact', h.step === 1 && await p.evaluate(() => document.getElementById('hot-name').value) === 'Task Force Ironhold' &&
    await p.evaluate(() => document.getElementById('sel-faction').value) === h.sides[0].faction);
  await next();
  check('...and forward again keeps player 2\'s', await p.evaluate(() => document.getElementById('hot-name').value) === 'The Hive' &&
    await p.evaluate(() => document.getElementById('sel-faction').value) === 'bugs');
  await next();
  check('then the battlefield', /^The battlefield$/.test(await title()) && await shown('sel-scen') && await shown('sel-planet') && await shown('sel-terrain') &&
    !(await shown('cat')));
  check('...summing up both forces', /Task Force Ironhold[\s\S]*The Hive/.test(await p.evaluate(() => document.getElementById('hot-sum').innerText)));
  await p.locator('#setup .sheet').screenshot({ path: path.join(SHOTS, 'skirmish-battlefield.png') });
  await setVal('sel-scen', 'meeting');
  await next();
  await p.waitForTimeout(600);
  const hs = await p.evaluate(() => { const s = window.PMC_STATE(); return { mode: s.cfg.mode, a: s.cfg.nameA, b: s.cfg.nameB, scen: s.cfg.scenario, ca: s.cfg.colourA, cb: s.cfg.colourB, bf: s.units.filter(u => u.side === 'B').every(u => u.faction === 'bugs') }; });
  check('the battle is the one both players built', hs.mode === 'hotseat' && hs.a === 'Task Force Ironhold' && hs.b === 'The Hive' && hs.scen === 'meeting' && hs.bf && hs.ca !== hs.cb,
    JSON.stringify(hs));

  console.log('\nCo-operative');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('coop'); });
  await p.waitForTimeout(200);
  check('player 1 builds a commando', /^Player 1 — muster your commando$/.test(await title()), await title());
  check('...with the old player tabs out of the way', !(await shown('solo-players')) && !(await shown('sel-solo-scen')));
  await roll(); await name('Ghost Team');
  await next();
  check('player 2 builds a commando of their own', /^Player 2 — muster your commando$/.test(await title()));
  check('...and the commandos share player 1\'s colour', !(await shown('colourpick')));
  await setVal('sel-faction', 'rebel');
  await roll(); await name('Red Cell');
  await next();
  check('then the battlefield: the OpFor and the solitaire scenario', await shown('sel-solo-op') && await shown('sel-solo-scen') && !(await shown('sel-solo-mode')) && !(await shown('sel-scen')));
  await setVal('sel-solo-scen', 's_crush');
  await next();
  await p.waitForTimeout(600);
  const cs = await p.evaluate(() => { const s = window.PMC_STATE(); return { coop: !!(s.solo && s.solo.coop), names: s.solo && s.solo.names, scen: s.cfg.scenario,
    owners: [...new Set(s.units.filter(u => u.side === 'A' && !u.extra).map(u => u.owner))].sort().join(),
    p2rebel: s.units.filter(u => u.side === 'A' && u.owner === 2 && !u.extra).every(u => u.faction === 'rebel') }; });
  check('the co-op battle has both commandos, each their own', cs.coop && cs.names.join() === 'Ghost Team,Red Cell' && cs.owners === '1,2' && cs.p2rebel && cs.scen === 's_crush',
    JSON.stringify(cs));

  console.log('\nDemo');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('demo'); });
  await p.waitForTimeout(200);
  h = await hot();
  const d1 = await p.evaluate(() => ({ faction: document.getElementById('sel-faction').value, name: document.getElementById('hot-name').value,
    legal: /legal/i.test(document.getElementById('faults').textContent), units: document.querySelectorAll('#chosen .pick').length }));
  check('force 1 starts rolled: a kind of force, a build and a name', d1.units > 0 && d1.legal && !!d1.name && /^Force 1/.test(await title()), JSON.stringify(d1));
  await setVal('sel-faction', d1.faction === 'xeno' ? 'pmc' : 'xeno');
  const d1b = await p.evaluate(() => ({ units: document.querySelectorAll('#chosen .pick').length, legal: /legal/i.test(document.getElementById('faults').textContent) }));
  check('...and changing its kind rolls a fresh build', d1b.units > 0 && d1b.legal);
  await next();
  const d2 = await p.evaluate(() => ({ units: document.querySelectorAll('#chosen .pick').length, name: document.getElementById('hot-name').value }));
  h = await hot();
  check('force 2 starts rolled too, in another colour', d2.units > 0 && !!d2.name && d2.name !== h.sides[0].name && h.step === 2, JSON.stringify(d2));
  await next();
  await next();
  await p.waitForTimeout(600);
  const ds = await p.evaluate(() => { const s = window.PMC_STATE(); return { mode: s.cfg.mode, a: s.cfg.nameA, b: s.cfg.nameB, ca: s.cfg.colourA, cb: s.cfg.colourB }; });
  check('the demo runs with the two forces', ds.mode === 'demo' && !!ds.a && !!ds.b && ds.ca !== ds.cb, JSON.stringify(ds));

  console.log('\nBack to an ordinary skirmish');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('ai'); });
  await p.waitForTimeout(200);
  check('against the AI is the single muster screen as before', !(await p.evaluate(() => window.__hot())) && await shown('sel-op') && await shown('sel-scen') &&
    await p.evaluate(() => document.getElementById('btn-start').textContent) === 'Take the field' && !(await p.evaluate(() => document.getElementById('sel-tier').disabled)));
  check('no page errors', errs.length === 0, errs.join('; '));

  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
