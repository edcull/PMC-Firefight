/* Hotseat, co-op and against-the-AI skirmishes build both forces before the battle (a demo rolls both and opens on the battlefield): each
   side in turn (kind, name, colours, units), then the battlefield (scenario,
   world, terrain). The opposition against the AI starts as a random kind of
   force with a rolled build. And on a page with no
   server behind it, the Multiplayer card is there but greyed out. */
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
  await p.evaluate(() => document.getElementById('btn-setup-back').click()); await p.waitForTimeout(200);
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
  // a demo opens on the battlefield with both forces already rolled
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('demo'); });
  await p.waitForTimeout(200);
  h = await hot();
  check('a demo opens on the battlefield, both forces rolled', h.step === 3 && h.sides.every(sd => sd && sd.keys.length > 0 && sd.name) &&
    h.sides[0].colour !== h.sides[1].colour && /battlefield/i.test(await title()), JSON.stringify(h.sides.map(sd => sd && sd.name)));
  const cards = await p.evaluate(() => document.querySelectorAll('#hot-sum [data-hotside]').length);
  check('...each force a button', cards === 2);
  // the Battle Tier and Priority Level are set once, on the battlefield, for both forces
  const tierShown = await p.evaluate(() => { const f = document.getElementById('tierpl-field'); return f.offsetParent !== null && !document.getElementById('sel-tier').disabled; });
  await setVal('sel-tier', '1'); await setVal('sel-pl', '1');
  h = await hot();
  const t1 = await p.evaluate((sides) => sides.map(sd => sd.keys.reduce((n, k) => n + window.PMC.profile(window.PMC.splitPick(k).key).tier, 0)), h.sides);
  check('...where the Tier is set, and both forces are rolled again to match', tierShown && t1.every(n => n > 0 && n <= 6), t1.join(' / ') + ' points at Tier I');
  // tap force 1 to change it: its kind, and back to the battlefield
  await p.evaluate(() => document.querySelector('#hot-sum [data-hotside="0"]').click()); await p.waitForTimeout(200);
  h = await hot();
  const d1 = await p.evaluate(() => ({ faction: document.getElementById('sel-faction').value, btn: document.getElementById('btn-start').textContent }));
  check('...tapping one opens it to change', h.step === 1 && h.edit && /battlefield/i.test(d1.btn), JSON.stringify(d1));
  await setVal('sel-faction', d1.faction === 'xeno' ? 'pmc' : 'xeno');
  await next();
  h = await hot();
  check('...and its button goes straight back to the battlefield, changed', h.step === 3 && !h.edit && h.sides[0].faction === (d1.faction === 'xeno' ? 'pmc' : 'xeno'),
    JSON.stringify({ step: h.step, f: h.sides[0].faction }));
  await next();
  await p.waitForTimeout(600);
  const ds = await p.evaluate(() => { const s = window.PMC_STATE(); return { mode: s.cfg.mode, a: s.cfg.nameA, b: s.cfg.nameB, ca: s.cfg.colourA, cb: s.cfg.colourB }; });
  check('the demo runs with the two forces', ds.mode === 'demo' && !!ds.a && !!ds.b && ds.ca !== ds.cb, JSON.stringify(ds));

  console.log('\nAgainst the AI');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('ai'); });
  await p.waitForTimeout(200);
  const start = await p.evaluate(() => window.__hot());
  check('it opens on the battlefield, both forces already rolled, as a demo does',
    /^The battlefield$/.test(await title()) && start.step === 3 && start.sides.every(sd => sd.keys.length > 0) &&
    start.sides[0].colour !== start.sides[1].colour && await shown('sel-terrain'), JSON.stringify(start).slice(0, 200));
  await p.click('[data-hotside="0"]');
  check('tap your force to change it: a name and colours of your own', /^Muster your force$/.test(await title()) &&
    await shown('hot-name') && await shown('btn-quick-colour') && !(await shown('sel-op')));
  await p.click('#btn-quick-clear');
  check('...Clear to build it by hand', await p.evaluate(() => document.querySelectorAll('#chosen .pick').length) === 0);
  await roll(); await name('Kowalski\u2019s Lads');
  await next();
  check('then the battlefield', /^The battlefield$/.test(await title()) && await shown('sel-scen'));
  await next();
  await p.waitForTimeout(600);
  const ai = await p.evaluate(() => { const s = window.PMC_STATE(); return { mode: s.cfg.mode, a: s.cfg.nameA, bx: s.units.filter(u => u.side === 'B').every(u => u.faction === 'xeno') }; });
  check('the AI commands the opposition you chose', ai.mode === 'ai' && ai.a === 'Kowalski\u2019s Lads' && ai.bx, JSON.stringify(ai));

  console.log('\nSolitaire');
  await p.evaluate(() => { window.PMCMenu.open(); window.PMC_SKIRMISH('solo'); });
  await p.waitForTimeout(200);
  check('solitaire keeps its single screen', !(await p.evaluate(() => window.__hot())) && await shown('sel-solo-scen') &&
    await p.evaluate(() => document.getElementById('btn-start').textContent) === 'Take the field' && !(await p.evaluate(() => document.getElementById('sel-tier').disabled)));
  check('...and can be up against a Xenotripod tribe', await p.evaluate(() => [...document.getElementById('sel-solo-op').options].some(o => o.value === 'xeno')));
  await setVal('sel-solo-op', 'xeno');
  await setVal('sel-solo-scen', 's_decap');
  await roll();
  await next();
  await p.waitForTimeout(600);
  const sx = await p.evaluate(() => { const s = window.PMC_STATE(); const b = s.units.filter(u => u.side === 'B'); return { n: b.length, xeno: b.every(u => u.faction === 'xeno'), leader: b.some(u => u.soloLeader) }; });
  check('...and the tribe takes the field, its Alpha squad to be hunted in a Decapitation', sx.n > 0 && sx.xeno && sx.leader, JSON.stringify(sx));
  check('no page errors', errs.length === 0, errs.join('; '));

  await b.close();
  console.log(problems.length ? '\n' + problems.length + ' problem(s)' : '\nall good');
  process.exit(problems.length ? 1 : 0);
})();
