/* A rebel force can take the field as the prawns: the same units and rules,
   drawn as tall crustacean aliens, riders on giant shrimp and every ground
   hull a walker. Picked as a Look on the rebel army; nothing else changes. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, shot } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
async function drain(p) {
  for (let i = 0; i < 16; i++) {
    const open = await p.evaluate(() => !document.getElementById('resolution').hidden);
    if (!open) break;
    await p.evaluate(() => { const c = document.getElementById('res-continue'); if (c) c.click(); });
    await p.waitForTimeout(140);
  }
  await p.waitForTimeout(120);
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(500);

  console.log('\n  The army picker');
  await p.evaluate(() => { if (window.PMCMenu) window.PMCMenu.close(); });
  const picker = await p.evaluate(() => {
    const sel = document.getElementById('sel-faction'), sk = document.getElementById('sel-skin');
    sel.value = 'rebel'; sel.dispatchEvent(new Event('change'));
    return { field: !document.getElementById('skin-field').hidden, options: [...sk.options].map(o => o.value) };
  });
  ok('a rebel force is offered a Look: humans or prawns', picker.field && picker.options.join() === ',prawn', JSON.stringify(picker));
  const other = await p.evaluate(() => {
    const sel = document.getElementById('sel-faction');
    sel.value = 'pmc'; sel.dispatchEvent(new Event('change'));
    return document.getElementById('skin-field').hidden;
  });
  ok('...and no other army is', other);

  console.log('\n  In battle');
  await p.evaluate(() => {
    window.PMC_NEWGAME({
      tier: 3, pl: 1, mode: 'ai', planet: 'barren', scenario: 'meeting', nameA: 'The Hive-born', nameB: 'Theirs',
      skinA: 'prawn', skinB: 'prawn', colourA: 'rust',
      armyA: ['rleaders', 'rinsurgents', 'rinsurgents', 'rharshminers', 'rhellriders', 'ricv', 'rltv', 'rmedart'],
      armyB: ['cmd3', 'regular', 'regular', 'lcv'], terrainSetup: 'auto'
    });
  });
  await p.waitForTimeout(900);
  await drain(p);
  const st = await p.evaluate(() => {
    const s = window.PMC_STATE();
    return {
      a: s.units.filter(u => u.side === 'A').map(u => ({ key: u.key, art: u.art, skin: u.skin || null, cls: u.cls })),
      b: s.units.filter(u => u.side === 'B').map(u => ({ key: u.key, art: u.art, skin: u.skin || null }))
    };
  });
  ok('every one of its units is a prawn', st.a.every(u => u.skin === 'prawn'), JSON.stringify(st.a.map(u => u.skin)));
  ok('...its infantry drawn from their own figures', st.a.filter(u => u.cls === 'infantry').every(u => /^pr_/.test(u.art)),
    st.a.map(u => u.art).join(', '));
  ok('...its hulls keep their own (and go on legs)', st.a.filter(u => u.cls === 'vehicle').every(u => !/^pr_/.test(u.art)));
  ok('a PMC force is not skinned, whatever the config says', st.b.every(u => !u.skin && !/^pr_/.test(u.art)), JSON.stringify(st.b));
  const rules = await p.evaluate(() => {
    const s = window.PMC_STATE(), R = window.PMC;
    // the same unit, built without the look, has the same numbers
    return s.units.filter(u => u.side === 'A').every(u => {
      const pr = R.profile(u.key);
      return u.fp === pr.fp && u.def === pr.def && u.morale === pr.morale;
    });
  });
  ok('...and nothing about the rules has changed', rules);
  await p.evaluate(() => { window.__sendIntent({ k: 'autosplit' }); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { window.__sendIntent({ k: 'autodeploy' }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const bt = document.querySelector('#context [data-act="vfaceall"]'); if (bt) bt.click(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: shot('prawns-deploy.png') });
  const drawn = await p.evaluate(() => {
    // one of each: an infantry figure, a rider on its shrimp, a walker
    const I = window.PMCIso, s = window.PMC_STATE();
    const inf = s.units.find(u => u.side === 'A' && u.key === 'rinsurgents');
    const c = I.figure('A', inf.art, 0, 'stand', 0);
    const g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0; for (let i = 3; i < g.length; i += 4) if (g[i] > 200) ink++;
    return { ink: ink, rider: !!I.figure('A', 'pr_hellrider', 0, 'stand', 0) };
  });
  ok('a prawn figure is drawn', drawn.ink > 400 && drawn.rider, JSON.stringify(drawn));

  console.log('\n  Multiplayer');
  const net = await p.evaluate(() => {
    const P = window.PMCProto;
    if (!P || !P.cleanForce) return null;
    return {
      rebel: P.cleanForce({ faction: 'rebel', skin: 'prawn', keys: [] }, 'A').skin,
      pmc: P.cleanForce({ faction: 'pmc', skin: 'prawn', keys: [] }, 'A').skin,
      junk: P.cleanForce({ faction: 'rebel', skin: 'robots', keys: [] }, 'A').skin
    };
  });
  ok('a player\'s force in a room keeps its look, and only a rebel one', !!net && (net.rebel === 'prawn' && net.pmc === '' && net.junk === ''), JSON.stringify(net));

  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log('\n  ' + pass + ' checks passed, ' + fail + ' failed.');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
