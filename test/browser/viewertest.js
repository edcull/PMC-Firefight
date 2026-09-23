/* The unit viewer is a bench for looking at one unit at a time. It matters that
   it is driving the real code — the same rules.js weapon table, the same iso.js
   sprites and the same fx.js effects the battle uses — so this checks that what
   it draws for each weapon style is what that style actually is. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT } = require('../where.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('    ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
function head(t) { console.log('\n  ' + t); }

// fire the currently picked unit and collect every effect that appears
async function fireAndWatch(p, ms) {
  await p.evaluate(() => window.__viewer.fire());
  const seen = {};
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 1600)) {
    const snap = await p.evaluate(() => window.__viewer.fx());
    snap.forEach(k => { seen[k] = (seen[k] || 0) + 1; });
    await p.waitForTimeout(35);
  }
  return seen;
}
async function pickAndFire(p, key, ms) {
  await p.evaluate((k) => window.__viewer.pick(k), key);
  await p.waitForTimeout(80);
  const spec = await p.evaluate(() => window.__viewer.spec());
  const seen = await fireAndWatch(p, ms);
  return { spec, seen, kinds: Object.keys(seen) };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'viewer.html'));
  await p.waitForTimeout(700);

  /* ------------------------------------------------------------ it is loaded */
  head('The bench opens with every unit in it');
  const loaded = await p.evaluate(() => ({
    units: document.querySelectorAll('#vlist .vu').length,
    groups: document.querySelectorAll('#vlist h4').length,
    w: document.getElementById('vboard').width,
    h: document.getElementById('vboard').height
  }));
  ok('every profile in all four lists is listed', loaded.units === 193, loaded.units + ' units');
  ok('...grouped the way the book groups them', loaded.groups > 20, loaded.groups + ' groups');
  ok('...and the stage has a canvas to draw on', loaded.w > 300 && loaded.h > 200,
    loaded.w + '×' + loaded.h);

  /* ------------------------------------------------- one unit per weapon style */
  head('Each weapon style draws the thing it is');

  /* A combat hull puts its main gun down twice over, with the crew firing
     alongside it. */
  const tank = await pickAndFire(p, 'mcv', 1800);
  ok('a tank throws a bolt', tank.spec.p === 'shellbig' && !!tank.seen.bolt, tank.kinds.join(' '));
  ok('...twice over, with the crew firing alongside',
    tank.spec.n === 2 && tank.spec.s === 'pistol' && !!tank.seen.tracer,
    tank.spec.n + ' rounds, crew: ' + tank.spec.s);

  const destroyer = await pickAndFire(p, 'ldestroyer', 1500);
  ok('a destroyer throws a bigger one', destroyer.spec.p === 'shellbig' && !!destroyer.seen.bolt,
    destroyer.kinds.join(' '));

  const mortar = await pickAndFire(p, 'mortarbattery', 2400);
  ok('a mortar battery lobs', mortar.spec.p === 'arc' && !!mortar.seen.lob, mortar.kinds.join(' '));
  ok('...three tubes at once', mortar.spec.n === 3, mortar.spec.n + ' tubes');

  const art = await pickAndFire(p, 'msupport', 2400);
  ok('a support vehicle lobs a heavier round', art.spec.p === 'arcbig' && !!art.seen.lob,
    art.kinds.join(' '));

  const sam = await pickAndFire(p, 'sam', 2000);
  ok('a SAM team launches a guided missile',
    sam.spec.p === 'missile' && !!sam.seen.missile, sam.kinds.join(' '));

  const gunship = await pickAndFire(p, 'tsc', 2000);
  ok('a transport strike craft ripples rockets', gunship.spec.s === 'rocket' && !!gunship.seen.missile,
    gunship.kinds.join(' '));
  ok('...over its door gun', gunship.spec.p === 'burst' && !!gunship.seen.tracer);

  const flamer = await pickAndFire(p, 'chem', 1600);
  ok('chem-warriors throw a cone of fire',
    flamer.spec.p === 'flame' && !!flamer.seen.flame, flamer.kinds.join(' '));
  ok('...and nothing flies while they do', !flamer.seen.tracer && !flamer.seen.bolt);

  const marksman = await pickAndFire(p, 'snipers', 1200);
  ok('a Gauss rifle draws a line', marksman.spec.p === 'rail' && !!marksman.seen.rail,
    marksman.kinds.join(' '));
  ok('...that is gone almost at once', marksman.seen.rail < 14,
    marksman.seen.rail + ' samples of it');

  // a crew-served cannon puts three down where a marksman's rifle fires one
  const rail = await pickAndFire(p, 'gausscannon', 1600);
  ok('a Gauss cannon fires three in quick succession',
    rail.spec.p === 'rail' && rail.spec.n === 3 && !!rail.seen.rail,
    rail.spec.n + ' shots, ' + rail.kinds.join(' '));
  ok('...and is on screen longer than the single line is',
    rail.seen.rail > marksman.seen.rail,
    rail.seen.rail + ' samples against ' + marksman.seen.rail);

  const mg = await pickAndFire(p, 'hpv', 1400);
  ok('a machine gun streams tracers', mg.spec.p === 'burst' && !!mg.seen.tracer, mg.kinds.join(' '));

  const auto = await pickAndFire(p, 'hmgteam', 1600);
  ok('a heavy MG team is an autocannon', auto.spec.p === 'chain' && !!auto.seen.tracer,
    auto.kinds.join(' '));

  const smg = await pickAndFire(p, 'enforcers', 1800);
  ok('enforcers fire an SMG', smg.spec.p === 'smg' && !!smg.seen.tracer, smg.kinds.join(' '));

  const assault = await pickAndFire(p, 'shock', 2000);
  ok('shock troopers go in behind a pair of charges', assault.spec.p === 'arc' && assault.spec.n === 2 &&
    !!assault.seen.lob, assault.spec.n + ' charges, ' + assault.kinds.join(' '));
  ok('...with their carbines after them', assault.spec.s === 'smg' && !!assault.seen.tracer);

  const rifle = await pickAndFire(p, 'regular', 1600);
  ok('a rifle team fires a volley', rifle.spec.p === 'small' && !!rifle.seen.tracer,
    rifle.kinds.join(' '));

  const pod = await pickAndFire(p, 'insertplat', 500);
  ok('a drop pod has no weapon and draws nothing',
    pod.spec.p === 'none' && !pod.seen.tracer && !pod.seen.bolt, pod.kinds.join(' ') || 'nothing');

  /* ------------------------------------------------------ battlefield insertion */
  head('The Xenotripods fire their own way');
  const groupsX = await p.evaluate(() => [...document.querySelectorAll('#vlist h4')].map(h => h.textContent).filter(t => /Xenotripods/.test(t)).length);
  ok('their units sit under their own name in the list', groupsX >= 6, groupsX + ' Xenotripod groups');
  const beta = await pickAndFire(p, 'xbeta3', 1200);
  ok('a Beta squad fires pulses of light', beta.spec.p === 'energy' && !!beta.seen.pulse, beta.kinds.join(' '));
  const gam = await pickAndFire(p, 'xgamma4', 1800);
  ok('a Gamma squad sends plasma orbs that burst', gam.spec.p === 'orb' && !!gam.seen.orb && !!gam.seen.orbburst, gam.kinds.join(' '));
  const strike = await pickAndFire(p, 'xstrike4', 2400);
  ok('a strike craft fires orbs and pulses together', !!strike.seen.pulse && !!strike.seen.orb, strike.kinds.join(' '));
  const adv = await pickAndFire(p, 'xstrike5', 2400);
  ok('an advanced strike craft fires pulses and rail lines', !!adv.seen.pulse && !!adv.seen.rail, adv.kinds.join(' '));
  const heps = await pickAndFire(p, 'xeps5', 1600);
  ok('advanced Epsilons fire three rail lines', heps.spec.p === 'rail' && heps.spec.n === 3 && !!heps.seen.rail, heps.kinds.join(' '));
  const tur = await pickAndFire(p, 'xdturret3', 1800);
  ok('a defensive turret lobs orbs', !!tur.seen.orb, tur.kinds.join(' '));

  head('It plays a Battlefield Insertion the way the battle does');

  // a squad is on the ground before you see it and comes up out of cover
  const stand = await p.evaluate(async () => {
    window.__viewer.pick('shock');
    window.__viewer.set('status', 'ready');
    const out = { fx: [], shown: [] };
    window.__viewer.insert();
    for (let i = 0; i < 26; i++) {
      const a = window.__viewer.arriving();
      out.shown.push(a.status);
      out.fx = out.fx.concat(window.__viewer.fx());
      await new Promise(r => setTimeout(r, 50));
    }
    out.after = window.__viewer.arriving();
    return out;
  });
  ok('a squad throws up dust as it breaks cover', stand.fx.indexOf('collapse') >= 0,
    Array.from(new Set(stand.fx)).join(' '));
  ok('...is drawn flat on its face first', stand.shown[0] === 'broken');
  ok('...then up on one knee', stand.shown.indexOf('suppressed') > stand.shown.indexOf('broken'));
  ok('...then standing, in about a second',
    stand.shown.lastIndexOf('suppressed') < stand.shown.length - 1 && stand.after.status === null);
  ok('...and it never leaves the ground', stand.after.lift === 0 && !stand.fx.includes('dropmark'));

  // a craft falls out of the sky onto its landing point
  const drop = await p.evaluate(async () => {
    window.__viewer.pick('insertplat');
    const out = { fx: [], lift: [] };
    window.__viewer.insert();
    for (let i = 0; i < 26; i++) {
      out.lift.push(window.__viewer.arriving().lift);
      out.fx = out.fx.concat(window.__viewer.fx());
      await new Promise(r => setTimeout(r, 50));
    }
    out.after = window.__viewer.arriving();
    return out;
  });
  ok('a rapid insertion platform drops from the sky', drop.lift[0] > 0,
    'starts ' + drop.lift[0] + 'px up');
  ok('...marking the ground it is coming down on', drop.fx.indexOf('dropmark') >= 0,
    Array.from(new Set(drop.fx)).join(' '));
  // it gathers speed the whole way down, so it arrives hard rather than drifting in
  const fallen = drop.lift.filter(v => v > 0);
  ok('...gathering speed the whole way down',
    fallen.every((v, i) => i === 0 || v < fallen[i - 1]) &&
    (fallen[1] - fallen[2]) < (fallen[fallen.length - 2] - fallen[fallen.length - 1]),
    fallen.join(' → '));
  ok('...and throwing up dust where it lands',
    drop.fx.indexOf('collapse') >= 0 && drop.after.lift === 0);
  ok('...without ever being drawn broken', drop.after.status === null && !drop.fx.includes('miss'));

  /* -------------------------------------------------------------- unit state */
  head('It shows a unit in each of its states');
  const states = await p.evaluate(async () => {
    const out = {};
    window.__viewer.pick('regular');
    ['ready', 'suppressed', 'broken'].forEach(s => {
      window.__viewer.set('status', s);
      const u = window.__viewer.unit();
      out[s] = { sp: u.sp, status: window.PMC.status(u) };
    });
    return out;
  });
  ok('ready is unsuppressed', states.ready.status === 'ready', states.ready.sp + ' SP');
  ok('suppressed really is suppressed', states.suppressed.status === 'suppressed',
    states.suppressed.sp + ' SP');
  ok('broken really is broken', states.broken.status === 'broken', states.broken.sp + ' SP');

  const squadStates = await p.evaluate(() => { window.__viewer.pick('regular'); return window.__viewer.states(); });
  ok('a squad is ready, suppressed, broken or destroyed', squadStates.join() === 'ready,suppressed,broken,destroyed',
    squadStates.join(' '));

  const hull = await p.evaluate(() => {
    window.__viewer.pick('mcv');
    const out = { states: window.__viewer.states(), buttons: [...document.querySelectorAll('[data-set="status"]')].map(b => b.textContent) };
    ['ready', 'damaged'].forEach(s => {
      window.__viewer.set('status', s);
      const u = window.__viewer.unit();
      out[s] = u.damage + '/' + u.str;
      out[s + 'Smoke'] = window.PMCIso.smoking(u);
    });
    window.__viewer.set('status', 'suppressed');
    out.refused = window.__viewer.unit().damage + '|' + document.querySelector('[data-set="status"].on').textContent;
    window.__viewer.set('status', 'destroyed');
    out.destroyedNote = document.getElementById('vstate').textContent;
    window.__viewer.set('status', 'ready');
    return out;
  });
  ok('a machine is ready, damaged or destroyed — never suppressed or broken',
    hull.states.join() === 'ready,damaged,destroyed' && hull.buttons.join() === 'ready,damaged,destroyed', hull.buttons.join(' '));
  ok('...damaged is half its Structure gone', hull.ready === '0/7' && hull.damaged === '4/7',
    'ready ' + hull.ready + ', damaged ' + hull.damaged);
  ok('...and it smokes only when damaged', !hull.readySmoke && hull.damagedSmoke);
  ok('...a state it cannot be in is not taken', hull.refused === '0|ready', hull.refused);
  ok('...destroyed is on the same row', /destroyed/.test(hull.destroyedNote), hull.destroyedNote);
  ok('the Destroyed toggle is gone from the actions', await p.evaluate(() => !document.querySelector('[data-do="destroyed"]')));

  const shrunk = await p.evaluate(() => {
    window.__viewer.pick('regular');
    window.__viewer.set('models', 3);
    const u = window.__viewer.unit();
    return { models: u.models, morale: window.PMC.currentMorale(u) };
  });
  ok('losing models drops the unit\'s Morale', shrunk.models === 3 && shrunk.morale < 5,
    shrunk.models + ' models, Morale ' + shrunk.morale);

  /* ---------------------------------------------------------------- movement */
  head('It walks the unit at its own Movement');
  const walked = await p.evaluate(async () => {
    window.__viewer.pick('regular');
    window.__viewer.set('status', 'ready');
    const before = window.__viewer.unit().x;
    window.__viewer.walk();
    await new Promise(r => setTimeout(r, 700));
    const during = window.__viewer.unit().x;
    window.__viewer.walk();
    await new Promise(r => setTimeout(r, 120));
    const after = window.__viewer.unit().x;
    return { before, during, after };
  });
  ok('walking moves it off its mark', Math.abs(walked.during - walked.before) > 1,
    walked.before.toFixed(1) + '" → ' + walked.during.toFixed(1) + '"');
  ok('...and stopping puts it back', Math.abs(walked.after - walked.before) < 0.01,
    'back at ' + walked.after.toFixed(1) + '"');

  const speed = await p.evaluate(async () => {
    async function run(key) {
      window.__viewer.pick(key);
      const a = window.__viewer.unit().x;
      window.__viewer.walk();
      await new Promise(r => setTimeout(r, 600));
      const b = window.__viewer.unit().x;
      window.__viewer.walk();
      return Math.abs(b - a);
    }
    return { slow: await run('hmgteam'), fast: await run('lhunter') };
  });
  ok('a fast hull covers more ground than a heavy weapons team in the same time',
    speed.fast > speed.slow,
    'MG team ' + speed.slow.toFixed(1) + '", light hunter ' + speed.fast.toFixed(1) + '"');

  /* ----------------------------------------------------------- every unit walks */
  head('Every squad in both lists picks its feet up');
  /* A kneeling gun crew and a figure lying down are in firing positions — right
     when they are shooting, wrong when they are crossing the table. This draws
     every infantry profile standing and then mid-stride and compares the pixels,
     so a kit that has no step frame at all cannot slip through. */
  const still = await p.evaluate(() => {
    const I = window.PMCIso;
    const cv = document.createElement('canvas');
    cv.width = 200; cv.height = 160;
    const g = cv.getContext('2d');
    // toScreen is in table coordinates, so centre the figure in the little canvas
    const at = { x: 6, y: 6 };
    const s0 = I.toScreen(at.x, at.y);
    function shot(prof, walk) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(1, 0, 0, 1, Math.round(cv.width / 2 - s0.x), Math.round(cv.height * 0.75 - s0.y));
      const u = Object.assign({}, prof, {
        side: 'A', models: prof.size, rules: prof.rules.slice(),
        sp: 0, alive: true, damage: 0, cargo: [], x: 0, y: 0, facing: 0
      });
      I.drawUnit(g, u, { at: at, lift: 0, walk: walk, status: 'ready',
        morale: prof.morale || 4 });
      return cv.toDataURL();
    }
    const stuck = [], blank = [];
    window.PMC.CATALOGUE.filter(pr => pr.cls === 'infantry').forEach(pr => {
      const a = shot(pr, 0), b = shot(pr, 1);
      if (a.length < 1200) { blank.push(pr.name); return; }   // nothing drawn at all
      if (a === b) stuck.push(pr.name);
    });
    return { stuck, blank };
  });
  ok('every squad is actually drawn', still.blank.length === 0, still.blank.join(', ') || 'all drawn');
  ok('no infantry unit stands still while it walks', still.stuck.length === 0,
    still.stuck.join(', ') || 'every squad picks its feet up');

  /* Jump troops do not walk at all: they go up on the jets. And a walker is a
     machine that has to take a stride rather than slide across the table. */
  const special = await p.evaluate(() => {
    const I = window.PMCIso, P = window.PMC;
    const cv = document.createElement('canvas');
    cv.width = 260; cv.height = 220;
    const g = cv.getContext('2d');
    const at = { x: 6, y: 6 };
    const s0 = I.toScreen(at.x, at.y);
    function shot(u, walk) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(1, 0, 0, 1, Math.round(cv.width / 2 - s0.x), Math.round(cv.height * 0.75 - s0.y));
      I.drawUnit(g, u, { at: at, lift: 0, walk: walk, status: 'ready', morale: 5 });
      return cv.toDataURL();
    }
    function build(key, prop) {
      const pr = P.profile(key);
      const u = Object.assign({}, pr, { side: 'A', models: pr.size, rules: pr.rules.slice(),
        sp: 0, alive: true, damage: 0, cargo: [], x: 0, y: 0, facing: 0.6 });
      if (prop) P.applyPropulsion(u, prop);
      return u;
    }
    const jump = build('protectorshm'), foot = build('protectors');
    const mech = build('acv', 'walker'), tracked = build('acv', 'tracked');
    return {
      jets: !!P.profile('protectorshm').jets,
      jumpMoves: shot(jump, 0) !== shot(jump, 1),
      // a jump trooper standing still looks like a Protector standing still
      sameStill: shot(jump, 0).length > 1200 && shot(foot, 0).length > 1200,
      mechStrides: shot(mech, 1) !== shot(mech, 2),
      hullSame: shot(tracked, 1) === shot(tracked, 2)
    };
  });
  head('Jump troops fly and walkers stride');
  ok('the hi-mobility Protectors are marked as jump troops', special.jets);
  ok('...and they leave the ground when they move', special.jumpMoves);
  ok('a walker swaps which leg leads, frame to frame', special.mechStrides);
  ok('...where the same hull on tracks does not', special.hullSame);

  /* -------------------------------------------------------- it is the real code */
  head('It is the game\'s own code, not a copy of it');
  const shared = await p.evaluate(() => ({
    rules: typeof window.PMC.weaponSpec === 'function',
    iso: typeof window.PMCIso.drawUnit === 'function',
    fx: typeof window.PMCFx.create === 'function',
    sfx: typeof window.SFX.rail === 'function',
    // the viewer's table has to agree with the engine's, unit for unit
    agrees: window.PMC.CATALOGUE.every(p => {
      const w = window.PMC.weaponSpec(p);
      return typeof w.p === 'string' && w.p.length > 0;
    })
  }));
  ok('it reads the weapon table out of rules.js', shared.rules);
  ok('it draws units with iso.js', shared.iso);
  ok('it plays effects out of fx.js', shared.fx);
  ok('it sounds them with sfx.js', shared.sfx);
  ok('...and every profile resolves to a style it can draw', shared.agrees);

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
