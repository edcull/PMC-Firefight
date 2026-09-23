/* The special actions, driven through the real interface: Hack and Supporting Fire. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, openMuster } = require('../where.js');
async function drain(p) {
  for (let i = 0; i < 14; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(150);
}
async function select(p, code) {
  await p.evaluate((c) => {
    const li = [...document.querySelectorAll('.ru')].find(e => e.textContent.includes(c));
    if (li) li.click();
  }, code);
  await p.waitForTimeout(350);
}
async function press(p, label) {
  await p.evaluate((l) => {
    const b = [...document.querySelectorAll('.slot')].find(x => x.textContent.trim().endsWith(l));
    if (b && !b.disabled) b.click();
  }, label);
  await p.waitForTimeout(300);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);
  // the muster screen sits behind the main menu now
  await openMuster(p);
  await p.evaluate(() => {
    document.getElementById('sel-tier').value = '3';
    document.getElementById('sel-mode').value = 'hotseat';
    document.getElementById('sel-op').value = 'mirror';
    window.__setMuster(['cmd2', 'regular', 'engineers', 'lifv', 'ew', 'recon:tracked:drone']);
  });
  await p.click('#btn-start');
  await p.waitForTimeout(900);
  await drain(p);
  await p.evaluate(() => document.querySelector('button[data-act="autodeploy"]').click());
  await p.waitForTimeout(400);
  await drain(p);
  await p.waitForSelector('button[data-act="start"]', { timeout: 15000 });
  await p.evaluate(() => document.querySelector('button[data-act="start"]').click());
  await p.waitForTimeout(800);
  await drain(p);

  // set the board up by hand: a drone for the EW team, a squad for the IFV
  const setup = await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    const mine = s.units.filter(u => u.side === 'A');
    const theirs = s.units.filter(u => u.side === 'B');
    const ew = mine.find(u => u.code === 'EW');
    const ifv = mine.find(u => u.transport);
    const squad = mine.find(u => u.cls === 'infantry' && u !== ew);
    const drone = theirs.find(u => u.drone);
    drone.x = 24; drone.y = 24;
    ew.x = 20; ew.y = 22; ew.activated = false;
    ifv.x = 20; ifv.y = 20; ifv.activated = false; ifv.facing = 0;
    squad.x = 22; squad.y = 20; squad.activated = false;
    theirs.forEach(u => { if (u !== drone) { u.x = 30; u.y = 26; } });
    window.PMC_SETVIEW(24, 22, 1);
    return { ew: ew.code, ifv: ifv.code, drone: drone.code + ' str' + drone.str, squad: squad.code };
  });
  console.log('board:', setup);

  await select(p, setup.ew);
  console.log('EW bar:', await p.evaluate(() => [...document.querySelectorAll('.slot')]
    .map(x => x.textContent.replace(/\s+/g, '') + (x.disabled ? '(off)' : '')).join(' ')));
  await press(p, 'Hack');
  console.log('hack targets:', await p.evaluate(() => window.__targetCodes()));
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    const d = s.units.find(u => u.drone && u.side === 'B');
    return window.__tapUnit(d);
  });
  await p.waitForTimeout(600);
  await drain(p);
  const afterHack = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const d = s.units.find(u => u.drone && u.side === 'B');
    return {
      damage: d ? d.damage : 'gone', alive: d ? d.alive : false, lockedOut: d ? !!d.activated : null,
      log: s.log.filter(l => /hack/i.test(l.text)).map(l => l.text)
    };
  });
  console.log('after the hack:', JSON.stringify(afterHack, null, 1));

  // Supporting Fire: the IFV shoots, then still unloads
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.activeSide = 'A';
    const ifv = s.units.find(u => u.side === 'A' && u.transport);
    const squad = s.units.find(u => u.side === 'A' && u.cls === 'infantry' && !u.aboard);
    window.PMC.embark(s, ifv, squad);
    ifv.activated = false;
    s.units.filter(u => u.side === 'B' && u.alive).forEach((u, i) => { u.x = 26 + i; u.y = 20; });
  });
  await p.waitForTimeout(200);
  await select(p, setup.ifv);
  await press(p, 'Support');
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    const t = s.units.find(u => u.side === 'B' && u.alive && u.x >= 0);
    window.__tapUnit(t);
  });
  await p.waitForTimeout(700);
  const midSupport = await p.evaluate(() => {
    const s = window.PMC_STATE();
    const ifv = s.units.find(u => u.side === 'A' && u.transport);
    return {
      stillActive: !ifv.activated, supportUsed: !!ifv.supportUsed,
      bar: [...document.querySelectorAll('.slot')].map(x => x.textContent.replace(/\s+/g, '') + (x.disabled ? '(off)' : '')).join(' '),
      shots: s.log.filter(l => l.t === 'shoot').length
    };
  });
  console.log('mid Supporting Fire:', JSON.stringify(midSupport, null, 1));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
