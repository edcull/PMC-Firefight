/* Putting troops aboard a hull before the battle (p. 36).

   The deployment screen lists every transport you have and lets you load a
   squad into one, or take it back off, before a shot is fired. The buttons that
   do it carried `data-load`/`data-unload` and no `data-act` — and the wiring
   only ever looked for `data-act`, so nothing was bound to them and pressing
   one did nothing at all. This drives the real buttons on both a desktop and a
   phone, which is the only way that would have been caught. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }

async function drain(p) {
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(120);
}

// the loading card lives in whichever panel this screen size uses
const CARD = () => {
  const hosts = [document.getElementById('modal-host'), document.getElementById('context'), document.getElementById('panel')];
  for (const h of hosts) {
    if (h && h.querySelector('.loadbox')) return h.querySelector('.loadbox');
  }
  return null;
};

async function run(p, label) {
  head(label);
  /* A named force rather than a rolled one, so the same two hulls and the same
     squads are on offer every run: an APC with room for two, and a drop pod
     that comes seated and must stay that way. */
  await p.evaluate(() => {
    window.PMC_NEWGAME({
      tier: 4, pl: 2, mode: 'hotseat', planet: 'barren', scenario: 'meeting',
      nameA: 'Ours', nameB: 'Theirs',
      armyA: ['cmd2', 'regular', 'shock', 'protectors', 'lapc:wheeled', 'insertplat'],
      armyB: ['cmd2', 'regular', 'veterans', 'rookie']
    });
  });
  await p.waitForTimeout(1200);
  await drain(p);

  const there = await p.evaluate(() => {
    const box = (() => {
      const hosts = [document.getElementById('modal-host'), document.getElementById('context'), document.getElementById('panel')];
      for (const h of hosts) if (h && h.querySelector('.loadbox')) return h.querySelector('.loadbox');
      return null;
    })();
    if (!box) return { none: true };
    return {
      rows: box.querySelectorAll('.loadrow').length,
      loads: box.querySelectorAll('[data-load]').length,
      unloads: box.querySelectorAll('[data-unload]').length
    };
  });
  ok('the deployment screen offers the hulls', !there.none && there.rows >= 2,
    there.none ? 'no loading card' : there.rows + ' hulls');
  ok('...with somebody to put in them', there.loads > 0, there.loads + ' units offered');
  // a drop pod is seated automatically, so there is already somebody to take off
  ok('...and the drop pod already has a squad aboard', there.unloads > 0,
    there.unloads + ' aboard');

  /* ---- putting a squad aboard ---- */
  const loaded = await p.evaluate(async () => {
    const hosts = [document.getElementById('modal-host'), document.getElementById('context'), document.getElementById('panel')];
    let box = null;
    for (const h of hosts) if (h && h.querySelector('.loadbox')) box = h.querySelector('.loadbox');
    const btn = box.querySelector('[data-load]');
    const unit = btn.getAttribute('data-load'), hull = btn.getAttribute('data-hull');
    const s = window.PMC_STATE();
    const before = (s.units.find(u => u.id === hull).cargo || []).length;
    btn.click();
    await new Promise(r => setTimeout(r, 260));
    const v = s.units.find(u => u.id === hull);
    const u = s.units.find(x => x.id === unit);
    return { before, after: (v.cargo || []).length, aboard: u.aboard === hull,
             name: u.name, hull: v.name };
  });
  ok('pressing one puts that squad aboard', loaded.after === loaded.before + 1,
    loaded.name + ' → ' + loaded.hull + ' (' + loaded.before + ' → ' + loaded.after + ')');
  ok('...and the squad knows it is in there', loaded.aboard);

  /* ---- and taking it back off ---- */
  const unloaded = await p.evaluate(async () => {
    const hosts = [document.getElementById('modal-host'), document.getElementById('context'), document.getElementById('panel')];
    let box = null;
    for (const h of hosts) if (h && h.querySelector('.loadbox')) box = h.querySelector('.loadbox');
    const btn = box.querySelector('[data-unload]');
    if (!btn) return { none: true };
    const unit = btn.getAttribute('data-unload'), hull = btn.getAttribute('data-hull');
    const s = window.PMC_STATE();
    const before = (s.units.find(u => u.id === hull).cargo || []).length;
    btn.click();
    await new Promise(r => setTimeout(r, 260));
    const v = s.units.find(u => u.id === hull);
    const u = s.units.find(x => x.id === unit);
    return { before, after: (v.cargo || []).length, off: !u.aboard, back: u.x < 0,
             name: u.name, hull: v.name };
  });
  ok('pressing the ✕ takes it back off', !unloaded.none && unloaded.after === unloaded.before - 1,
    unloaded.name + ' off ' + unloaded.hull + ' (' + unloaded.before + ' → ' + unloaded.after + ')');
  ok('...and it is back in hand to place', unloaded.off && unloaded.back);

  /* ---- the card keeps up ---- */
  const redrawn = await p.evaluate(() => {
    const hosts = [document.getElementById('modal-host'), document.getElementById('context'), document.getElementById('panel')];
    for (const h of hosts) if (h && h.querySelector('.loadbox')) {
      const box = h.querySelector('.loadbox');
      return { text: box.innerText.replace(/\n+/g, ' · ').slice(0, 90),
               loads: box.querySelectorAll('[data-load]').length };
    }
    return { none: true };
  });
  ok('...and the card is redrawn to match', !redrawn.none && redrawn.loads > 0,
    redrawn.text);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  const desk = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  desk.on('pageerror', e => errs.push('desktop: ' + e.message));
  await desk.goto('file://' + path.join(ROOT, 'index.html'));
  await desk.waitForTimeout(500);
  await run(desk, 'On a desktop');
  await desk.close();

  const phone = await b.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  phone.on('pageerror', e => errs.push('phone: ' + e.message));
  await phone.goto('file://' + path.join(ROOT, 'index.html'));
  await phone.waitForTimeout(600);
  await run(phone, 'And on a phone, where it was reported');
  await phone.close();

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
