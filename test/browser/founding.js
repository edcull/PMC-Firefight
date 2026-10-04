const { chromium } = require('playwright');
const { page } = require('../where.js');
let pass=0, fail=0;
const ok=(n,c,note)=>{c?pass++:fail++;console.log('  '+(c?'✓':'✗')+' '+n+(note?'  — '+note:''));};
(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page);
  await p.waitForTimeout(700);
  await p.evaluate(() => { try{localStorage.clear();}catch(e){} });
  // the campaign is a card on the main menu the page opens on
  await p.evaluate(() => document.getElementById('btn-campaign').click());
  await p.waitForTimeout(500);

  const first = await p.evaluate(() => ({
    hasName: !!document.getElementById('found-name'), campName: !!document.getElementById('camp-name'),
    fields: [...document.querySelectorAll('#camp-body .field label')].map(l=>l.textContent.trim())
  }));
  ok('the first screen asks for the campaign’s name, not the force’s', !first.hasName && first.campName, first.fields.join(' | '));

  await p.evaluate(() => document.querySelector('[data-go="newcamp"]').click());
  await p.waitForTimeout(400);
  // the name and its colour chip sit in a box no taller than they are; the units take the rest of the page
  const box = await p.evaluate(() => {
    const id = document.querySelector('#camp-body .found-id'), row = id && id.querySelector('.name-row'), un = document.querySelector('#camp-body .found-units');
    const h = (e) => e ? Math.round(e.getBoundingClientRect().height) : 0;
    return { id: h(id), row: h(row), units: h(un) };
  });
  ok('the name box is only as tall as the name', box.id > 0 && box.id <= box.row + 40, box.id + 'px for a ' + box.row + 'px row');
  ok('...and the units take the rest', box.units > box.id * 2, 'units ' + box.units + 'px');
  await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); });   // the colours drop down from the chip beside the name
  const found = await p.evaluate(() => ({
    name: !!document.getElementById('found-name'),
    nameVal: (document.getElementById('found-name')||{}).value,
    swatches: document.querySelectorAll('#camp-body [data-campcolour]').length,
    colours: window.PMCIso.COLOUR_KEYS.length,
    on: (document.querySelector('#camp-body [data-campcolour].on')||{}).getAttribute ? document.querySelector('#camp-body [data-campcolour].on').getAttribute('data-campcolour') : null,
    heading: document.getElementById('camp-title').textContent
  }));
  ok('the founding screen asks for the name', found.name, '"'+found.nameVal+'"');
  ok('...and offers the colours', found.swatches === found.colours, found.swatches + ' swatches of ' + found.colours + ' army colours');
  ok('...with one already picked', !!found.on, found.on);
  ok('the heading no longer repeats a name you have not given', !/Ironhold/.test(found.heading), found.heading);

  // pressed while it is greyed out, the charter says what it still needs rather than doing nothing
  const early = await p.evaluate(() => {
    const btn = document.querySelector('[data-go="dofound"]');
    const off = btn.getAttribute('aria-disabled') === 'true';
    btn.click();
    const tip = document.querySelector('.tip.on');
    return { off: off, tip: tip ? tip.textContent : '', stillFounding: !!document.getElementById('found-name') };
  });
  ok('a greyed-out charter, pressed, says what it still needs', early.off && /Six Tier I units/.test(early.tip) && early.stillFounding, early.tip);
  await p.evaluate(() => window.PMCTips && window.PMCTips.hide());

  // type a name, pick a colour, then add units — the name must survive the redraws
  await p.evaluate(() => { const n=document.getElementById('found-name'); n.value='Cullen Free Company'; });
  await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); document.querySelector('[data-campcolour="crimson"]').click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); });
  const kept = await p.evaluate(() => ({
    val: document.getElementById('found-name').value,
    on: document.querySelector('#camp-body [data-campcolour].on').getAttribute('data-campcolour')
  }));
  ok('picking a colour keeps the typed name', kept.val === 'Cullen Free Company', kept.val);
  ok('...and the colour sticks', kept.on === 'crimson', kept.on);

  // a new force fights at Tier I, where a Tier II machine cannot be fielded
  const offered = await p.evaluate(() => [...document.querySelectorAll('#found-cat [data-add]')].map(b => {
    const pr = window.PMC.profile(window.PMC.splitPick(b.getAttribute('data-add')).key); return { tier: pr.tier, cls: pr.cls };
  }));
  ok('no Tier II vehicle is offered to a new force', offered.length > 10 && !offered.some(o => o.tier === 2 && o.cls !== 'infantry') &&
    offered.some(o => o.tier === 2) && offered.some(o => o.tier === 1 && o.cls !== 'infantry'), offered.length + ' offered');

  // a vehicle's propulsion and Drone Control: icons; the drives in a list by the icon
  await p.evaluate(() => { const b = [...document.querySelectorAll('#found-cat [data-add]')].find(x => x.getAttribute('data-add') === 'lpv'); b.click(); document.querySelectorAll('#camp-body .cmodal').forEach((m) => { m.hidden = true; }); });
  await p.waitForTimeout(150);
  const icons = await p.evaluate(() => { const c = [...document.querySelectorAll('#found-chosen .fcard')].pop(); const d = c.querySelector('[data-fdrone]'), pr = c.querySelector('[data-fprop]');
    return { drone: !!(d && d.querySelector('svg')) && d.getAttribute('aria-pressed') === 'false' && !/crew|DRN/.test(d.textContent), prop: !!(pr && pr.querySelector('svg')) && !/std|whl|trk/.test(pr.textContent) }; });
  ok('a vehicle’s drive and Drone Control are icons, not words', icons.drone && icons.prop, JSON.stringify(icons));
  await p.evaluate(() => [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-fdrone]').click());
  const droned = await p.evaluate(() => [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-fdrone]').getAttribute('aria-pressed'));
  ok('...a tap on the crew icon makes it a drone, and the icon says so', droned === 'true');
  await p.evaluate(() => [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-fprop]').click());
  await p.waitForTimeout(100);
  const pop = await p.evaluate(() => { const q = document.querySelector('#camp-body .propop'); if (!q) return null; const r = q.getBoundingClientRect(); return { n: q.querySelectorAll('[data-fpropset]').length, shown: getComputedStyle(q).visibility === 'visible' && r.width > 100 && r.top >= 0 && r.bottom <= innerHeight }; });
  ok('...a tap on the drive icon lists the drives beside it', pop && pop.n >= 2 && pop.shown, JSON.stringify(pop));
  await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/drive-pop.png' : '/dev/null' }).catch(() => {});
  await p.evaluate(() => document.querySelector('#camp-body .propop [data-prop="tracked"]').click());
  const after = await p.evaluate(() => ({ open: !!document.querySelector('#camp-body .propop'), title: [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-fprop]').getAttribute('aria-label') }));
  ok('...picking one sets it and closes the list', !after.open && /Tracked/.test(after.title), JSON.stringify(after));
  await p.evaluate(() => [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-fprop]').click());
  await p.evaluate(() => document.getElementById('found-name').click());
  ok('...and a tap elsewhere closes it', await p.evaluate(() => !document.querySelector('#camp-body .propop')));
  await p.evaluate(() => [...document.querySelectorAll('#found-chosen .fcard')].pop().querySelector('[data-drop]').click());

  // fill a legal founding force
  const built = await p.evaluate(() => {
    const add = (sel) => { const b=[...document.querySelectorAll('#found-cat [data-add]')].find(x=>x.getAttribute('data-add')===sel); if(b) b.click(); };
    for (let i=0;i<6;i++) add('recruits');
    for (let i=0;i<2;i++) add('rookie');
    const doc = document.querySelector('#camp-body [data-doc]');
    if (doc) doc.click();
    return { name: document.getElementById('found-name').value,
             picks: document.querySelectorAll('#found-chosen [data-drop]').length };
  });
  ok('the name survives adding eight units and a doctrine',
    built.name === 'Cullen Free Company', built.name + ' / ' + built.picks + ' units');

  const signed = await p.evaluate(() => {
    const btn = document.querySelector('[data-go="dofound"]');
    const wasOff = btn.getAttribute('aria-disabled') === 'true';
    btn.click();
    const c = window.PMC_CAMPAIGN.get();
    return { wasOff: wasOff, name: c.companies.A.name, colour: c.companies.A.colour,
             rivals: (c.rivals||[]).map(r=>r.colour) };
  });
  await p.waitForTimeout(300);
  ok('the charter signs', !signed.wasOff);
  ok('...under the name you typed', signed.name === 'Cullen Free Company', signed.name);
  ok('...in the colours you picked', signed.colour === 'crimson', signed.colour);
  ok('...and every rival wears something else',
    signed.rivals.length > 0 && signed.rivals.every(c => c && c !== 'crimson') &&
    new Set(signed.rivals).size === signed.rivals.length,
    signed.rivals.join(', '));

  const hub = await p.evaluate(() => ({
    flashes: document.querySelectorAll('#camp-body .tierbadge').length,
    text: document.querySelector('#camp-body').textContent.indexOf('Cullen Free Company') >= 0
  }));
  ok('the hub shows the company by name', hub.text);
  ok('...with its tier badge beside it', hub.flashes > 0, hub.flashes + ' badges');

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ')||'none'));
  await b.close();
  process.exit(fail||errs.length?1:0);
})();
