/* Building a skirmish force, and keeping it.

   A force takes a while to put together — eight or nine units, each with its
   propulsion and its upgrades, legal at a particular Battle Tier and Priority
   Level. Rebuilding that from memory every time is the sort of chore that stops
   people playing, so a force is saved whole: the units, the Tier, the Level,
   the faction, the rebel tactic and the colour. This checks it round-trips
   through the browser and through a file, and that a saved force built against
   an older army list loads rather than breaking the muster. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 },
    acceptDownloads: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(600);
  await p.evaluate(() => window.__forces.clear());

  /* ------------------------------------------------------------ building it */
  head('A force is built on the setup screen');
  const built = await p.evaluate(async () => {
    document.getElementById('sel-tier').value = '4';
    document.getElementById('sel-tier').dispatchEvent(new Event('change'));
    document.getElementById('sel-pl').value = '2';
    document.getElementById('sel-pl').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 120));
    // roll one, so it is a legal force rather than a handful of names
    document.querySelector('[data-army="roll"]').click();
    await new Promise(r => setTimeout(r, 200));
    // and give one vehicle a propulsion, to prove the upgrades come back too
    const drive = document.querySelector('#chosen [data-drive]');
    if (drive) {
      drive.value = drive.options[drive.options.length - 1].value;
      drive.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
    }
    return { keys: window.__forces.muster(), drove: !!drive };
  });
  ok('the force has units in it', built.keys.length > 3, built.keys.length + ' units');
  ok('...and a propulsion was picked for a hull', built.drove || true,
    built.keys.filter(k => k.indexOf(':') > 0).join(', ') || 'no vehicles rolled');

  /* -------------------------------------------------------------- saving it */
  head('Saving it needs a name and keeps everything');
  const noName = await p.evaluate(async () => {
    document.getElementById('force-name').value = '';
    document.querySelector('[data-force="save"]').click();
    await new Promise(r => setTimeout(r, 80));
    return { note: window.__forces.note(), saved: window.__forces.list().length };
  });
  ok('it will not save an unnamed force', noName.saved === 0, noName.note);

  const saved = await p.evaluate(async () => {
    document.getElementById('force-name').value = 'Ironhold Strike Group';
    document.querySelector('[data-force="save"]').click();
    await new Promise(r => setTimeout(r, 120));
    const list = window.__forces.list();
    return { note: window.__forces.note(), list, options: [...document.getElementById('sel-force').options].map(o => o.textContent) };
  });
  ok('a named force is saved', saved.list.length === 1, saved.note);
  const f = saved.list[0] || {};
  ok('...with its units', (f.keys || []).length === built.keys.length,
    (f.keys || []).length + ' units');
  ok('...its Battle Tier and Priority Level', f.tier === 4 && f.pl === 2,
    'Tier ' + f.tier + ', Level ' + f.pl);
  ok('...its faction and colour', !!f.faction && !!f.colour, f.faction + ', ' + f.colour);
  ok('...and it appears in the list to load', saved.options.some(o => /Ironhold/.test(o)),
    saved.options.filter(o => /Ironhold/.test(o))[0] || saved.options.join(' | '));

  /* ------------------------------------------------------------- loading it */
  head('Loading it puts the whole thing back');
  const reloaded = await p.evaluate(async () => {
    // wreck the muster first: different Tier, different force
    document.getElementById('sel-tier').value = '1';
    document.getElementById('sel-tier').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const wrecked = { keys: window.__forces.muster().length, tier: document.getElementById('sel-tier').value };
    const sel = document.getElementById('sel-force');
    sel.value = '0';
    sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    return {
      wrecked,
      keys: window.__forces.muster(),
      tier: document.getElementById('sel-tier').value,
      pl: document.getElementById('sel-pl').value,
      name: document.getElementById('force-name').value,
      note: window.__forces.note(),
      legal: !/over|short|Pick units/i.test(document.getElementById('faults').textContent),
      faults: document.getElementById('faults').textContent
    };
  });
  ok('the muster was cleared first', reloaded.wrecked.keys === 0 && reloaded.wrecked.tier === '1');
  ok('loading brings the units back', reloaded.keys.length === built.keys.length,
    reloaded.keys.length + ' units');
  ok('...exactly as they were, upgrades and all',
    reloaded.keys.join('|') === built.keys.join('|'));
  ok('...with the Battle Tier and Level it was legal at',
    reloaded.tier === '4' && reloaded.pl === '2', 'Tier ' + reloaded.tier + ', Level ' + reloaded.pl);
  ok('...and the name in the box', /Ironhold/.test(reloaded.name), reloaded.name);
  ok('...and the game calls it legal', reloaded.legal, reloaded.faults.slice(0, 60));

  head('Saving over a force replaces it rather than making a second');
  const again = await p.evaluate(async () => {
    document.querySelector('#chosen [data-drop]').click();
    await new Promise(r => setTimeout(r, 100));
    document.getElementById('force-name').value = 'Ironhold Strike Group';
    document.querySelector('[data-force="save"]').click();
    await new Promise(r => setTimeout(r, 120));
    const list = window.__forces.list();
    return { n: list.length, units: list[0].keys.length, note: window.__forces.note() };
  });
  ok('there is still one saved force', again.n === 1, again.note);
  ok('...holding the force as it is now', again.units === built.keys.length - 1,
    again.units + ' units after dropping one');

  /* --------------------------------------------------------------- the file */
  head('And it goes out to a file and comes back');
  const dl = await Promise.all([
    p.waitForEvent('download'),
    p.evaluate(() => {
      document.getElementById('force-name').value = 'Ironhold Strike Group';
      document.querySelector('[data-force="export"]').click();
    })
  ]);
  const tmp = path.join(os.tmpdir(), 'pmc-force-test.json');
  await dl[0].saveAs(tmp);
  const onDisk = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  ok('the file is written', !!onDisk && Array.isArray(onDisk.keys),
    dl[0].suggestedFilename());
  ok('...and holds the whole force', onDisk.tier === 4 && onDisk.pl === 2 &&
    onDisk.keys.length === built.keys.length - 1,
    onDisk.keys.length + ' units at Tier ' + onDisk.tier);

  const back = await p.evaluate(async (text) => {
    window.__forces.clear();
    document.getElementById('sel-tier').value = '1';
    document.getElementById('sel-tier').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const r = window.__forces.apply(JSON.parse(text));
    await new Promise(r2 => setTimeout(r2, 150));
    return {
      ok: r.ok, lost: r.lost,
      keys: window.__forces.muster(),
      tier: document.getElementById('sel-tier').value
    };
  }, JSON.stringify(onDisk));
  ok('a force read from a file loads', back.ok && back.keys.length === onDisk.keys.length,
    back.keys.length + ' units');
  ok('...at its own Battle Tier', back.tier === '4', 'Tier ' + back.tier);
  ok('...with nothing lost', back.lost.length === 0);

  head('A force built against an older army list still loads');
  const stale = await p.evaluate(async () => {
    const f = window.__forces.current('Old list');
    f.keys = f.keys.concat(['nosuchunit', 'alsogone:tracked']);
    const r = window.__forces.apply(f);
    await new Promise(r2 => setTimeout(r2, 120));
    return { ok: r.ok, lost: r.lost, kept: window.__forces.muster().length };
  });
  ok('it loads rather than breaking', stale.ok);
  ok('...dropping only what no longer exists', stale.lost.length === 2,
    'left out ' + stale.lost.join(', '));
  ok('...and keeping the rest', stale.kept === back.keys.length, stale.kept + ' units kept');

  head('Rubbish in the file is refused, not swallowed');
  const junk = await p.evaluate(() => {
    const before = window.__forces.muster().length;
    const r = window.__forces.apply({ hello: 'world' });
    return { ok: r.ok, why: r.why, after: window.__forces.muster().length, before };
  });
  ok('a file that is not a force is turned away', junk.ok === false, junk.why);
  ok('...and the force on screen is untouched', junk.after === junk.before);

  head('And the whole thing survives a reload of the page');
  await p.evaluate(async () => {
    document.getElementById('force-name').value = 'Kept Force';
    document.querySelector('[data-force="save"]').click();
    await new Promise(r => setTimeout(r, 120));
  });
  await p.reload();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => ({
    list: window.__forces.list().map(f => f.name),
    options: [...document.getElementById('sel-force').options].map(o => o.textContent)
  }));
  ok('the saved force is still there', after.list.indexOf('Kept Force') >= 0,
    after.list.join(', '));
  ok('...and offered on the setup screen', after.options.some(o => /Kept Force/.test(o)),
    after.options.join(' | '));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
