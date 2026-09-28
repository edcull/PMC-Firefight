/* Whose go it is, at a glance: the phone's header always carries the turn pill
   and a bar of the side's colour; each new turn is announced across the table;
   a unit may Skip; and the End phase asks each player whether to surrender
   before the next turn. */
const { chromium } = require('playwright');
const { page: PAGE } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

async function boot(p, mode) {
  await p.evaluate((mode) => window.PMC_NEWGAME({
    tier: 3, pl: 1, mode: mode, aiSides: mode === 'ai' ? ['B'] : [], planet: 'industrial', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs',
    armyA: ['cmd3', 'regular', 'veterans', 'shock'],
    armyB: ['cmd3', 'regular', 'veterans', 'shock']
  }), mode);
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.__autoDeployBoth());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = window.__beginButton(); if (b) b.click(); });
  await p.waitForTimeout(600);
}
const look = () => {
  const s = window.PMC_STATE(), h = document.querySelector('header'), pill = document.getElementById('hdr-active');
  const tb = document.getElementById('turnbanner');
  return { turn: s.turn, side: s.activeSide, endAsk: s.endAsk && s.endAsk.side, over: !!s.over,
    pill: pill.offsetParent !== null ? pill.textContent : null, cls: h.className,
    banner: tb && !tb.hidden ? tb.textContent : null,
    endCard: !!document.querySelector('[data-act="enddone"]'), surrender: !!document.querySelector('[data-act="surrender"]') };
};

(async () => {
  const br = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errs = [];
  const p = await br.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + PAGE); await p.waitForTimeout(600);

  console.log('\n  the briefing, as deployment begins');
  await p.evaluate(() => window.PMC_NEWGAME({ tier: 3, pl: 1, mode: 'ai', aiSides: ['B'], planet: 'industrial', scenario: 'meeting',
    nameA: 'Ours', nameB: 'Theirs', armyA: ['cmd3', 'regular', 'veterans', 'shock'], armyB: ['cmd3', 'regular', 'veterans', 'shock'] }));
  await p.waitForTimeout(1200);
  const bf = await p.evaluate(() => {
    const m = document.getElementById('obj-modal');
    return { open: !m.hidden, text: m.textContent };
  });
  ok('the scenario briefing opens by itself', bf.open && /Meeting engagement/.test(bf.text) && /To win/.test(bf.text));
  ok('...saying where the force goes down', /strip|shaded/.test(bf.text));
  await p.evaluate(() => document.getElementById('obj-done').click());
  await p.waitForTimeout(200);
  const st1 = await p.evaluate(() => ({ swap: !!document.querySelector('[data-act="swapopen"]'), go: !!document.querySelector('[data-act="deployready"]'),
    list: !!document.querySelector('[data-deploy], .dpr'), auto: !!document.querySelector('[data-act="autodeploy"]'),
    text: document.querySelector('#context') ? document.querySelector('#context').textContent : '' }));
  ok('before deploying, the Actions panel offers Modify your army or Continue to deployment', st1.swap && st1.go);
  ok('...and not yet the deployment itself, nor the scenario text', !st1.list && !st1.auto && !/Two companies meet/.test(st1.text));
  await p.evaluate(() => document.querySelector('[data-act="swapopen"]').click());
  await p.waitForTimeout(300);
  ok('Modify your army opens the swap in the panel', await p.evaluate(() => document.querySelectorAll('[data-swappick]').length > 0));
  await p.evaluate(() => document.querySelector('[data-act="deployready"]').click());
  await p.waitForTimeout(300);
  ok('Continue to deployment brings up the units to place', await p.evaluate(() => !!document.querySelector('[data-act="autodeploy"]') && !document.querySelector('[data-act="deployready"]')));

  console.log('\n  hotseat, on a phone');
  await boot(p, 'hotseat');
  let s = await p.evaluate(look);
  ok('the phone header shows whose turn it is', !!s.pill && /Ours|Theirs/.test(s.pill), s.pill);
  ok('...with a bar of that side\'s colour', new RegExp('turn-' + s.side).test(s.cls), s.cls);
  ok('the first turn is announced', !!s.banner && /Turn 1/.test(s.banner), s.banner);

  // every unit skips until the End phase asks
  for (let i = 0; i < 40; i++) {
    s = await p.evaluate(look);
    if (s.endAsk || s.over) break;
    await p.evaluate(() => {
      const st = window.PMC_STATE();
      if (st.faceAsk) return window.__sendIntent({ k: 'vfaceall' });
      const mine = st.units.filter((x) => x.side === st.activeSide && x.alive && !x.activated && x.x >= 0 && !x.aboard)[0];
      if (!mine) return;
      window.__sendIntent({ k: 'select', id: mine.id });
      window.__sendIntent({ k: 'action', id: 'skip' });
    });
    await p.waitForTimeout(120);
  }
  const skipped = await p.evaluate(() => window.PMC_STATE().log.some((l) => /skips its action/.test(l.text)));
  ok('units skip their action', skipped);
  ok('the End phase asks the first player', s.endAsk === 'A', JSON.stringify(s));
  ok('...with Carry on and Surrender on its card', s.endCard && s.surrender);
  await p.evaluate(() => document.querySelector('[data-act="enddone"]').click());
  await p.waitForTimeout(200);
  s = await p.evaluate(look);
  ok('then the second', s.endAsk === 'B');
  await p.evaluate(() => document.querySelector('[data-act="enddone"]').click());
  await p.waitForTimeout(400);
  s = await p.evaluate(look);
  ok('and the next turn is announced', s.turn === 2 && !!s.banner && /Turn 2/.test(s.banner), s.banner);

  console.log('\n  against the AI');
  await boot(p, 'ai');
  s = await p.evaluate(look);
  for (let i = 0; i < 30 && s.side !== 'A'; i++) { await p.waitForTimeout(300); s = await p.evaluate(look); }
  ok('the player\'s own go reads "Your turn"', s.pill === 'Your turn', s.pill);
  ok('...marked as theirs', /your-turn/.test(s.cls), s.cls);

  /* Our units skip; the AI plays its own. The End phase is not put to us while
     the AI's last activations are still being drawn, only once they have been. */
  let early = 0, asked = false, seenReplay = false;
  for (let i = 0; i < 400 && !asked; i++) {
    const r = await p.evaluate(() => {
      const st = window.PMC_STATE(), drawing = window.__showQueue() > 0;
      const card = !!document.querySelector('[data-act="enddone"]');
      if (!drawing && !card && st.activeSide === 'A' && !st.endAsk) {
        const m = st.units.filter((x) => x.side === 'A' && x.alive && !x.activated && x.x >= 0 && !x.aboard)[0];
        if (m) { window.__sendIntent({ k: 'select', id: m.id }); window.__sendIntent({ k: 'action', id: 'skip' }); }
      }
      const res = document.getElementById('resolution');
      return { endAsk: !!st.endAsk, drawing: drawing, card: card, cards: !!(res && !res.hidden) };
    });
    if (r.endAsk && r.drawing) seenReplay = true;
    if (r.card && (r.drawing || r.cards)) early++;
    if (r.card && !r.drawing) asked = true;
    await p.waitForTimeout(100);
  }
  ok('against the AI the End phase is asked', asked);
  ok('...never while the AI\'s activations are still being drawn, nor with a result card still up', early === 0, early + ' times' + (seenReplay ? '' : ' (the replay was already over when it came)'));

  console.log('\n  errors: ' + (errs.join(' | ') || 'none'));
  console.log('  ' + pass + ' checks passed' + (fail ? ', ' + fail + ' failed.' : '.'));
  process.exitCode = fail || errs.length ? 1 : 0;
  await br.close();
})();
