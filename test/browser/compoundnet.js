/* A compound laid out by hand, online (Close Encounters, p. 163): in a game room
   with a Close Encounters scenario the host lays the compound out on the editor
   and the other player reads it off the terms; the battle is fought in it. And a
   campaign keeps one for each size of table, laid out from its hub. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const { ROOT, SHOTS, signInLobby, tmpData } = require('../where.js');
const PORT = 9700 + Math.floor(Math.random() * 200);

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { DATA_DIR: tmpData(), CAMPAIGNS_DIR: tmpData(), PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await wait(150);
    up = await fetch('http://localhost:' + PORT + '/health').then(r => r.ok).catch(() => false);
  }
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  try {
    async function page(name) {
      const ctx = await b.newContext({ viewport: { width: 1340, height: 900 } });
      const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(e.message));
      await p.goto('http://localhost:' + PORT + '/');
      await p.waitForTimeout(700);
      await signInLobby(p, name, 'guest');
      await p.evaluate(() => { window.__room = null; window.PMCLobby.net().on('game', m => { window.__room = m.room; }); });
      await p.waitForTimeout(400);
      return p;
    }
    console.log('\n  A game room');
    const force = { faction: 'pmc', tactic: '', keys: ['cmd2', 'regular', 'regular', 'regular', 'rookie', 'rookie'], colour: 'ochre', name: '' };
    const p1 = await page('Iron Wolf'), p2 = await page('Red Dawn');
    await p1.evaluate((f) => window.PMCLobby.net().send('game.create', { name: 'CE', settings: { tier: 3, pl: 1, planet: 'desert', scenario: 'ce_clear', private: true, options: { closeEncounters: true } }, force: f }), force);
    await p1.waitForTimeout(600);
    const code = await p1.evaluate(() => window.__room && window.__room.id);
    await p2.evaluate((c) => window.PMCLobby.net().send('game.join', { id: c }), code);
    await p2.waitForTimeout(600);
    await p2.evaluate((f) => window.PMCLobby.net().send('game.force', { force: Object.assign({}, f, { colour: 'rose' }) }), force);
    await p2.waitForTimeout(300);
    const note = (p) => p.evaluate(() => { const n = document.getElementById('lob-cmp-note'); return n ? n.textContent : null; });
    const hostBtn = await p1.evaluate(() => !!document.querySelector('#lobby [data-lob="cmpedit"]'));
    const guestBtn = await p2.evaluate(() => !!document.querySelector('#lobby [data-lob="cmpedit"]'));
    ok('a Close Encounters room: the compound in the terms, the game\'s to begin with', /by the game/.test(await note(p1) || '') && /by the game/.test(await note(p2) || ''), await note(p2));
    ok('...the host may lay it out by hand, the other player only reads it', hostBtn && !guestBtn);
    await p1.evaluate(() => document.querySelector('#lobby [data-lob="cmpedit"]').click());
    await p1.waitForTimeout(200);
    const up1 = await p1.evaluate(() => { const m = document.getElementById('cmp-modal'); if (m.hidden) return null; const r = document.getElementById('cmp-canvas').getBoundingClientRect(); const el = document.elementFromPoint(r.left + 5, r.top + 5); return el && el.id; });
    ok('...on the editor, over the room', up1 === 'cmp-canvas', String(up1));
    await p1.evaluate(() => document.querySelector('[data-cmp="gen"]').click());
    const plan = await p1.evaluate(() => JSON.parse(JSON.stringify(window.PMCCompoundEdit.plan())));
    await p1.evaluate(() => document.getElementById('cmp-done').click());
    await p1.waitForTimeout(600);
    ok('laid out: the other player reads the host\'s compound off the terms', /Laid out by the host: \d+ rooms?/.test(await note(p2) || '') &&
      await p2.evaluate((cells) => window.__room && window.__room.settings.compound && window.__room.settings.compound.cells === cells, plan.cells), await note(p2));
    await p1.screenshot({ path: path.join(SHOTS, 'lobby-compound.png') }).catch(() => {});
    for (const p of [p1, p2]) await p.evaluate(() => window.PMCLobby.net().send('game.ready', { ready: true }));
    await p1.waitForTimeout(400);
    await p1.evaluate(() => window.PMCLobby.net().send('game.start'));
    await p1.waitForTimeout(2500);
    const built = await p2.evaluate(() => { const s = window.PMC_STATE(); return s ? { compound: !!s.compound, log: (s.log || []).some((l) => /laid out by hand/.test(l.text || '')) } : null; });
    ok('the battle is fought in it', built && built.compound && built.log, JSON.stringify(built));

    console.log('\n  A campaign\'s compounds, on a Close Encounters contract');
    // a single-player campaign under Close Encounters: one compound a size of table, laid out on the contract fought in it
    const p3 = await b.newPage({ viewport: { width: 1340, height: 900 } });
    p3.on('pageerror', e => errs.push(e.message));
    await p3.goto('http://localhost:' + PORT + '/');
    await p3.waitForTimeout(700);
    const hub = await p3.evaluate(() => {
      window.PMC_CAMPAIGN.fresh('solo');
      const C = window.PMCCamp;
      const camp = C.newCampaign({ mode: 'solo', nameA: 'Tunnel Rats', factionA: 'pmc' });
      C.found(camp.companies.A, ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'], 'S2');
      camp.companies.A.name = 'Tunnel Rats';
      camp.rivals = C.foundRivals(camp, 1) || camp.rivals;
      camp.options = { closeEncounters: true, ceFreq: 'all' };
      delete camp.system;
      window.PMC_CAMPAIGN.set(camp);
      window.PMC_CAMPAIGN.open('hub');
      return { cmp: !!document.querySelector('.hubcmp'), opts: !!document.querySelector('.hubopts') };
    });
    ok('the hub no longer carries the compounds or the optional rules', !hub.cmp && !hub.opts, JSON.stringify(hub));
    await p3.evaluate(() => document.querySelector('#camp-body [data-go="fmodal"][data-kind="rivals"]').click());
    await p3.waitForTimeout(200);
    await p3.evaluate(() => document.querySelector('[data-rivcontract]').click());
    await p3.waitForTimeout(250);
    await p3.evaluate(() => { const t = document.querySelector('#camp-body [data-take-offer]'); if (t) t.click(); });
    await p3.waitForTimeout(300);
    const box = await p3.evaluate(() => { const c = document.querySelector('#camp-body .ccompound'); return c ? { text: c.textContent, lay: !!c.querySelector('.start[data-go="cmpedit"][data-size="48x48"]') } : null; });
    ok('a Close Encounters contract: its compound, the game\'s, to lay out', box && /4′ × 4′ table/.test(box.text) && /game lays out/.test(box.text) && box.lay, JSON.stringify(box));
    if (box && box.lay) {
      await p3.evaluate(() => document.querySelector('#camp-body .ccompound [data-go="cmpedit"]').click());
      await p3.waitForTimeout(200);
      await p3.evaluate(() => { document.querySelector('[data-cmp="gen"]').click(); document.getElementById('cmp-done').click(); });
      await p3.waitForTimeout(300);
      const kept = await p3.evaluate(() => ({ text: (document.querySelector('#camp-body .ccompound') || {}).textContent || '', gen: !!document.querySelector('#camp-body .ccompound [data-go="cmpgen"]'), plan: !!(window.PMC_CAMPAIGN.get().compounds || {})['48x48'] }));
      ok('...one laid out is kept with the campaign', kept.plan && /laid out by hand/.test(kept.text) && kept.gen, JSON.stringify(kept));
      await p3.screenshot({ path: path.join(SHOTS, 'contract-compound.png') }).catch(() => {});
    }
    ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  } finally {
    await b.close();
    srv.kill();
  }
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
