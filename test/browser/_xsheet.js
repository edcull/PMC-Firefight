const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForTimeout(800);
  const which = process.env.WHICH || 'inf';
  const zoom = +(process.env.Z || 1);
  const only = process.env.KEYS ? process.env.KEYS.split(',') : null;
  await p.evaluate(([which, zoom, only]) => {
    if (only) window.__KEYS = only;
    const R = window.PMC, I = window.PMCIso;
    I.setSideColour('A', which.split(':')[1] || 'ochre'); which = which.split(':')[0];
    document.body.innerHTML = '';
    document.body.style.background = '#3d3a30';
    const keys = window.__KEYS || (which === 'inf'
      ? ['xalpha1', 'xalpha3', 'xalpha5', 'xbeta2', 'xbeta4', 'xgamma3', 'xgamma5', 'xdelta1', 'xdelta3', 'xeps1', 'xeps2', 'xeps3', 'xeps4', 'xeps5']
      : ['xstrike2', 'xstrike4', 'xstrike5', 'xrecon', 'xtelecraft', 'xshieldb', 'xdturret1', 'xtturret2', 'xsturret3']);
    const cols = which === 'inf' ? 5 : 3, cw = 290 * (only ? 1.6 : 1), ch = (which === 'inf' ? 250 : 330) * (only ? 1.6 : 1), SC = (which === 'inf' ? 2.4 : 2.0) * zoom;
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.ceil(keys.length / cols) * ch;
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    g.fillStyle = '#5e5440'; g.fillRect(0, 0, cv.width, cv.height);
    keys.forEach((k, i) => {
      const pr = R.profile(k);
      const u = { id: 'A' + i, key: k, side: 'A', art: pr.art, cls: pr.cls, name: pr.name, tier: pr.tier, size: pr.size, models: pr.size, rules: pr.rules.slice(),
        x: 20, y: 20, facing: which === 'inf' ? 0 : 0.5, alive: true, sp: 0, morale: pr.morale, str: pr.str, damage: 0, faction: 'xeno', move: pr.move };
      const q = I.toScreen(u.x, u.y);
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      g.save();
      g.beginPath(); g.rect(cx, cy, cw, ch); g.clip();
      g.translate(cx + cw / 2, cy + ch * (which === 'inf' ? 0.72 : 0.8));
      g.scale(SC, SC);
      g.translate(-q.x, -q.y);
      I.drawUnit(g, u, { status: 'ready', walk: 0 });
      g.restore();
      g.fillStyle = '#fff'; g.font = '13px monospace'; g.fillText(pr.name, cx + 6, cy + 16);
      g.strokeStyle = '#222'; g.strokeRect(cx, cy, cw, ch);
    });
  }, [which, zoom, only]);
  await p.waitForTimeout(400);
  const c = await p.$('canvas');
  await c.screenshot({ path: process.argv[2] });
  console.log('errors', errs.join(' | ') || 'none');
  await b.close();
})();
