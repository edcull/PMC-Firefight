/* The unit viewer is a bench for looking at one unit at a time. It matters that
   it is driving the real code — the same rules.js weapon table, the same iso.js
   sprites and the same fx.js effects the battle uses — so this checks that what
   it draws for each weapon style is what that style actually is. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

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
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1500, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'viewer.html'));
  await p.waitForTimeout(700);

  /* ------------------------------------------------------------ it is loaded */
  head('The bench opens with every unit in it');
  // the unit list is an atlas, one army to a tab: add the tabs up
  const loaded = { units: 0, groups: 0, drawn: 0 };
  for (const f of ['pmc', 'rebel', 'bugs', 'xeno']) {
    await p.click(`#vfacs [data-fac="${f}"]`);
    await p.waitForTimeout(250);
    const c = await p.evaluate(() => ({
      units: document.querySelectorAll('#vlist .unit').length,
      groups: document.querySelectorAll('#vlist h3.group').length,
      drawn: document.querySelectorAll('#vlist canvas.tile[data-drawn]').length
    }));
    loaded.units += c.units; loaded.groups += c.groups; loaded.drawn += c.drawn;
  }
  await p.click('#vfacs [data-fac="pmc"]');
  await p.waitForTimeout(250);
  Object.assign(loaded, await p.evaluate(() => ({ w: document.getElementById('vboard').width, h: document.getElementById('vboard').height })));
  ok('every profile in all four lists is listed', loaded.units === 200, loaded.units + ' units');
  ok('...grouped the way the book groups them', loaded.groups > 20, loaded.groups + ' groups');
  ok('...each a card drawn by the game\'s renderer', loaded.drawn > 0, loaded.drawn + ' pictures drawn in view');
  const listPick = await p.evaluate(() => {
    document.querySelector('#vlist .unit[data-k="veterans"]').click();
    return { name: document.querySelector('.vctlpanel .vrow b').textContent, on: (document.querySelector('#vlist .unit.on') || {}).id };
  });
  ok('picking a card puts that unit on the stage', listPick.name === 'Veterans' && listPick.on === 'vp-veterans', JSON.stringify(listPick));
  const found = await p.evaluate(async () => {
    const q = document.getElementById('vsearch');
    const hits = (w) => { q.value = w; q.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#vlist .unit')].filter(u => !u.hidden).length; };
    const n = hits('rifle'), armies = document.querySelectorAll('#vlist h2.faction').length;
    const rule = hits('markerlights');                  // a special rule, in no unit's name
    q.value = ''; q.dispatchEvent(new Event('input'));
    return { n, armies, rule };
  });
  ok('a search looks through every army by unit name', found.n > 3 && found.armies > 1 && found.rule === 0,
    found.n + ' named rifle across ' + found.armies + ' armies, ' + found.rule + ' for a rule');
  // who is in it, by rank: a squad's line-up, a hull's commander, nobody in a swarm
  const ranks = await p.evaluate(async () => {
    const out = {};
    for (const k of ['rangers', 'snipers', 'mcv', 'battack']) {
      window.__viewer.pick(k);
      await new Promise(r => setTimeout(r, 60));
      const e = document.querySelector('.vranks');
      out[k] = e ? e.textContent : null;
    }
    return out;
  });
  ok('the stats show the ranks: Rangers a Staff Sergeant, a Sergeant and specialists', /Staff Sergeant, Sergeant, 6 Specialists/.test(ranks.rangers || ''), ranks.rangers);
  ok('...a sniper team a Staff Sergeant and a Sergeant', /Staff Sergeant, Sergeant$/.test(ranks.snipers || ''), ranks.snipers);
  ok('...a hull its crew, each by job and rank', /Crew Sergeant \(Commander\), Corporal \(Driver\), Private \(Gunner\), Private \(Loader\)/.test(ranks.mcv || ''), ranks.mcv);
  ok('...and a swarm nobody named', /counted/.test(ranks.battack || ''), ranks.battack);
  // the army under the unit's name, its rules a tap away; an aircraft with Firepower shows the Strafing Run
  const army = await p.evaluate(async () => {
    window.__viewer.pick('xalpha3');
    await new Promise(r => setTimeout(r, 60));
    const pill = document.querySelector('.varmy');
    const name = pill && pill.textContent;
    if (pill) pill.click();
    await new Promise(r => setTimeout(r, 60));
    const m = document.getElementById('varmymodal');
    const txt = m && !m.hidden ? m.textContent : '';
    if (m) m.hidden = true;
    window.__viewer.pick('fsc');
    await new Promise(r => setTimeout(r, 60));
    const strafe = /Strafing Run/.test((document.querySelector('.vstatsbody') || {}).textContent || '');
    return { name, rules: /Limited Senses/.test(txt) && /Mental Projection/.test(txt) && /Cloaking System/.test(txt), strafe };
  });
  ok('the unit\'s army is a pill under its name', army.name === 'Xenotripods', army.name);
  ok('...a tap opens the army\'s own rules', army.rules);
  ok('an aircraft with Firepower shows the Strafing Run among its rules', army.strafe);
  // Fire! works out the average shot at the target picked in the list, and the target shows what it leaves
  const shot = await p.evaluate(async () => {
    window.__viewer.pick('hmgteam');
    await new Promise(r => setTimeout(r, 60));
    const tab = document.querySelector('[data-tab="opts"]'); if (tab) tab.click();
    const line = () => (document.getElementById('vtgtline') || {}).textContent || '';
    const fresh = line();
    let after = fresh;
    // a shot can miss: fire until one hits (a dozen goes is plenty)
    for (let i = 0; i < 12; i++) {
      document.querySelector('[data-do="fire"]').click();
      await new Promise(r => setTimeout(r, 1100));
      after = line();
      if (/[1-9]\d* hits?/.test(after)) break;
    }
    // and again: the same unit at the same target shows the same result every time
    document.querySelector('[data-do="fire"]').click();
    await new Promise(r => setTimeout(r, 1100));
    const again = line();
    const sel = document.getElementById('vtarget');
    sel.value = 'lcv'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    return { fresh, after, again, picked: line(), options: sel.querySelectorAll('option').length };
  });
  ok('the Target list offers every unit', shot.options > 100, shot.options + ' units');
  ok('Fire! works out the average shot at the target and says what it does', /^Average [\d.]+ hits? \u2192 [\d.]+ casualt(y|ies) · [\d.]+ SP — |No hits —/.test(shot.after) && shot.after !== shot.fresh, shot.after);
  ok('...the same every time it fires at the same target', shot.again === shot.after, shot.again);
  /* The Range slider stands the target off at that range, measured as the battle
     measures it, and pulls the stage out to hold both; Fire! is barred where the
     weapon cannot reach or must not shoot (a mortar's Minimum Range 12"), and
     what it brings changes with the range (half range, limited Anti-tank). */
  const ranged = await p.evaluate(async () => {
    const V = window.__viewer, fire = () => document.querySelector('[data-do="fire"]');
    const slide = (v) => { const r = document.getElementById('vrange'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); };
    const out = {};
    V.pick('regular');
    // (the panel is drawn afresh on a pick: the list is looked up each time)
    const aim = (k) => { const sel = document.getElementById('vtarget'); sel.value = k; sel.dispatchEvent(new Event('change', { bubbles: true })); };
    aim('regular');
    out.start = V.range();
    slide(16); out.far = V.range(); out.farShot = V.shot(); out.zoom = V.zoom().zoom;
    slide(9); out.half = V.shot(); out.label = document.getElementById('vrangelab').textContent;
    V.pick('mortarbattery');
    slide(6); out.close = { range: V.range(), disabled: fire().disabled, title: fire().title };
    slide(12); out.mortar = { disabled: fire().disabled, shot: V.shot() };
    fire().click();
    await new Promise(r => setTimeout(r, 1100));
    out.mortarLine = (document.getElementById('vtgtline') || {}).textContent || '';
    V.pick('ecobats');
    aim('lcv');
    slide(6); out.at6 = V.shot();
    slide(8); out.at8 = V.shot();
    aim('regular');
    slide(12);
    return out;
  });
  ok('the target stands at the range set, as the battle measures it', ranged.start.dist === 12 && Math.abs(ranged.far.dist - 16) < 1e-9 && ranged.far.to.x - ranged.start.to.x === 4,
    ranged.start.dist + '" → ' + ranged.far.dist + '"');
  ok('...the stage pulls out to the whole firing line to hold both', ranged.zoom === 1, 'zoom ' + ranged.zoom);
  ok('...and the slider reads the range', /Range — 9"/.test(ranged.label), ranged.label);
  const lbl = (m) => (m ? m.parts.map((q) => q.label) : []);
  ok('within half range Fire! shoots with +2 more', ranged.half.fp === ranged.farShot.fp + 2 && lbl(ranged.half).indexOf('within half range') >= 0,
    'FP ' + ranged.farShot.fp + ' → ' + ranged.half.fp);
  ok('a mortar inside its Minimum Range cannot be told to fire, and says why', ranged.close.disabled && /Minimum Range of 12"/.test(ranged.close.title), ranged.close.title);
  ok('...at 12" it fires, at Basic Firepower: no Fire! bonus', !ranged.mortar.disabled && ranged.mortar.shot.basic && lbl(ranged.mortar.shot).indexOf('Fire! (stationary)') < 0 &&
    /^Average|^No hits/.test(ranged.mortarLine), ranged.mortarLine);
  ok('limited Anti-tank bears on a hull at 6" and not at 8"', lbl(ranged.at6).indexOf('Anti-tank') >= 0 && lbl(ranged.at8).indexOf('Anti-tank') < 0,
    lbl(ranged.at6).join(', ') + ' / ' + lbl(ranged.at8).join(', '));
  // the target's Suppression bar fills once the shot lands, as in the battle
  const fill = await p.evaluate(async () => {
    window.__viewer.pick('hmgteam');
    await new Promise(r => setTimeout(r, 60));
    // a squad to shoot at: a hull takes Damage, not Suppression
    const sel = document.getElementById('vtarget');
    sel.value = 'regular'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 12; i++) {
      document.querySelector('[data-do="fire"]').click();
      const seen = [];
      for (let k = 0; k < 24; k++) { seen.push(window.__viewer.targetSp()); await new Promise(r => setTimeout(r, 70)); }
      const top = Math.max.apply(null, seen);
      if (top > 1) return { seen, rising: seen.some((v, j) => j && v > seen[j - 1] && v < top) };
    }
    return { seen: [], rising: false };
  });
  ok('the target\'s Suppression bar fills up once the shot lands, not all at once', fill.rising, fill.seen.join(' '));
  ok('...and a different target starts fresh', /6 of 6 Structure left/.test(shot.picked) && !/hit/.test(shot.picked), shot.picked);
  await p.evaluate(() => window.__viewer.pick('regular'));
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

  const gunship = await pickAndFire(p, 'fsc', 2000);
  ok('a flexible strike craft ripples rockets', gunship.spec.s === 'rocket' && !!gunship.seen.missile,
    gunship.kinds.join(' '));
  ok('...over its nose gun', gunship.spec.p === 'burst' && !!gunship.seen.tracer);

  const flamer = await pickAndFire(p, 'chem', 1600);
  ok('chem-warriors throw a cone of fire',
    flamer.spec.p === 'flame' && !!flamer.seen.flame, flamer.kinds.join(' '));
  ok('...and nothing flies while they do', !flamer.seen.tracer && !flamer.seen.bolt);

  const marksman = await pickAndFire(p, 'lrrp', 1200);
  ok('a Gauss rifle draws a line', marksman.spec.p === 'rail' && !!marksman.seen.rail,
    marksman.kinds.join(' '));
  // each line is gone almost at once (the LRRP fire a pair)
  ok('...that is gone almost at once', marksman.seen.rail / marksman.spec.n < 14,
    marksman.seen.rail + ' samples of ' + marksman.spec.n);
  // the sniper team: two heavy rounds, then two Gauss lines
  const sniper = await pickAndFire(p, 'snipers', 2000);
  ok('a sniper team fires two shells and two Gauss lines',
    sniper.spec.p === 'shell' && sniper.spec.n === 2 && sniper.spec.s === 'rail' && sniper.spec.sn === 2 &&
    !!sniper.seen.bolt && !!sniper.seen.rail, JSON.stringify(sniper.spec) + ' ' + sniper.kinds.join(' '));

  // a crew-served cannon puts three down where the marksmen's rifles fire two
  const rail = await pickAndFire(p, 'gausscannon', 1600);
  ok('a Gauss cannon fires three in quick succession',
    rail.spec.p === 'rail' && rail.spec.n === 3 && !!rail.seen.rail,
    rail.spec.n + ' shots, ' + rail.kinds.join(' '));
  ok('...and is on screen longer than the pair is',
    rail.seen.rail > marksman.seen.rail,
    rail.seen.rail + ' samples against ' + marksman.seen.rail);

  const mg = await pickAndFire(p, 'rlmg', 1400);   // a machine-gun team (the HPV mounts an autocannon)
  ok('a machine gun streams tracers', mg.spec.p === 'burst' && !!mg.seen.tracer, mg.kinds.join(' '));

  const auto = await pickAndFire(p, 'hmgteam', 1600);
  ok('a heavy MG team is an autocannon', auto.spec.p === 'chain' && !!auto.seen.tracer,
    auto.kinds.join(' '));

  const smg = await pickAndFire(p, 'enforcers', 1800);
  ok('enforcers fire an SMG', smg.spec.p === 'smg' && !!smg.seen.tracer, smg.kinds.join(' '));

  const assault = await pickAndFire(p, 'shock', 2000);
  ok('shock troopers go in behind a pair of grenades, thrown and going off', assault.spec.p === 'frag' && assault.spec.n === 2 &&
    !!assault.seen.frag && !!assault.seen.fragburst, assault.spec.n + ' grenades, ' + assault.kinds.join(' '));
  ok('...with their carbines after them', assault.spec.s === 'smg' && !!assault.seen.tracer);

  const rifle = await pickAndFire(p, 'regular', 1600);
  ok('a rifle team fires a volley', rifle.spec.p === 'small' && !!rifle.seen.tracer,
    rifle.kinds.join(' '));

  const pod = await pickAndFire(p, 'insertplat', 500);
  ok('a drop pod has no weapon and draws nothing',
    pod.spec.p === 'none' && !pod.seen.tracer && !pod.seen.bolt, pod.kinds.join(' ') || 'nothing');

  /* ------------------------------------------------------ battlefield insertion */
  head('The Xenotripods fire their own way');
  await p.click('#vfacs [data-fac="xeno"]');
  await p.waitForTimeout(250);
  const groupsX = await p.evaluate(() => document.querySelectorAll('#vlist h3.group').length);
  await p.click('#vfacs [data-fac="pmc"]');
  ok('their units sit under their own name in the list', groupsX >= 6, groupsX + ' Xenotripod groups');
  const beta = await pickAndFire(p, 'xbeta3', 1200);
  ok('a Beta squad fires pulses of light', beta.spec.p === 'energy' && !!beta.seen.pulse, beta.kinds.join(' '));
  const gam = await pickAndFire(p, 'xgamma4', 1800);
  ok('a Gamma squad sends plasma orbs that burst', gam.spec.p === 'orb' && !!gam.seen.orb && !!gam.seen.orbburst, gam.kinds.join(' '));
  const strike = await pickAndFire(p, 'xstrike4', 2400);
  ok('a high-grade strike craft lobs three orbs, nothing else', strike.spec.p === 'orb' && strike.spec.n === 3 && !strike.spec.s &&
    !!strike.seen.orb && !strike.seen.pulse, strike.kinds.join(' '));
  const adv = await pickAndFire(p, 'xstrike5', 2400);
  ok('an advanced strike craft lobs four orbs', adv.spec.p === 'orb' && adv.spec.n === 4 && !!adv.seen.orb && !adv.seen.rail, adv.kinds.join(' '));
  const delta = await pickAndFire(p, 'xdelta3', 1800);
  ok('core Deltas fire their SMGs, every round splashing', delta.spec.p === 'smg' && !!delta.seen.tracer && !!delta.seen.impact, delta.kinds.join(' '));
  const heps = await pickAndFire(p, 'xeps5', 1600);
  ok('advanced Epsilons fire five rail lines', heps.spec.p === 'rail' && heps.spec.n === 5 && !!heps.seen.rail, heps.kinds.join(' '));
  const tur = await pickAndFire(p, 'xdturret3', 1800);
  ok('a defensive turret lobs three orbs', tur.spec.n === 3 && !!tur.seen.orb, tur.kinds.join(' '));

  head('It plays a Battlefield Insertion the way the battle does');

  // a squad is on the ground before you see it and comes up out of cover
  const stand = await p.evaluate(async () => {
    window.__viewer.pick('shock');
    window.__viewer.set('status', 'ready');
    const out = { fx: [], shown: [], hidden: [] };
    window.__viewer.insert();
    for (let i = 0; i < 40; i++) {
      const a = window.__viewer.arriving();
      out.hidden.push(!!a.hidden);
      if (!a.hidden) out.shown.push(a.pose);
      out.fx = out.fx.concat(window.__viewer.fx());
      await new Promise(r => setTimeout(r, 50));
    }
    out.after = window.__viewer.arriving();
    return out;
  });
  ok('an insertion starts from an empty field', stand.hidden[0] === true && stand.hidden.indexOf(false) > 0,
    stand.hidden.filter(Boolean).length * 50 + 'ms with nothing on the table');
  ok('a squad throws up dust as it breaks cover', stand.fx.indexOf('collapse') >= 0,
    Array.from(new Set(stand.fx)).join(' '));
  ok('...is drawn flat on its face first', stand.shown[0] === 'prone');
  ok('...then up on one knee', stand.shown.indexOf('kneel') > stand.shown.indexOf('prone'));
  ok('...then standing, in about a second',
    stand.shown.lastIndexOf('kneel') < stand.shown.length - 1 && stand.after.pose === null);
  ok('...and it never leaves the ground', stand.after.lift === 0 && !stand.fx.includes('dropmark'));

  // a craft falls out of the sky onto its landing point
  const drop = await p.evaluate(async () => {
    window.__viewer.pick('insertplat');
    const out = { fx: [], lift: [], hidden: [] };
    window.__viewer.insert();
    for (let i = 0; i < 40; i++) {
      const a = window.__viewer.arriving();
      out.hidden.push(!!a.hidden);
      if (!a.hidden) out.lift.push(a.lift);
      out.fx = out.fx.concat(window.__viewer.fx());
      await new Promise(r => setTimeout(r, 50));
    }
    out.after = window.__viewer.arriving();
    return out;
  });
  ok('a rapid insertion platform drops from the sky, onto an empty field', drop.hidden[0] === true && drop.lift[0] > 0,
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
  ok('...without ever being drawn lying down', drop.after.pose === null && !drop.fx.includes('miss'));

  /* -------------------------------------------------------------- unit state */
  head('It has a way back to the game');
  const home = await p.evaluate(() => { const a = document.getElementById('vhome'); return a ? { href: a.getAttribute('href'), text: a.getAttribute('aria-label') || a.textContent, shown: a.offsetParent !== null } : null; });
  ok('a home link to the game\'s main menu', !!home && home.shown && /main menu/.test(home.text) && /^(index|firefight)\.html$/.test(home.href), home && home.href);

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
    out.destroyedOn = document.querySelector('[data-set="status"].on').textContent;
    window.__viewer.set('status', 'ready');
    return out;
  });
  ok('a machine is ready, damaged or destroyed — never suppressed or broken',
    hull.states.join() === 'ready,damaged,destroyed' && hull.buttons.join() === 'ready,damaged,destroyed', hull.buttons.join(' '));
  ok('...damaged is half its Structure gone', hull.ready === '0/7' && hull.damaged === '4/7',
    'ready ' + hull.ready + ', damaged ' + hull.damaged);
  ok('...and it smokes only when damaged', !hull.readySmoke && hull.damagedSmoke);
  ok('...a state it cannot be in is not taken', hull.refused === '0|ready', hull.refused);
  ok('...destroyed is on the same row', hull.destroyedOn === 'destroyed', hull.destroyedOn);
  ok('the Destroyed toggle is gone from the actions', await p.evaluate(() => !document.querySelector('[data-do="destroyed"]')));

  const shrunk = await p.evaluate(() => {
    window.__viewer.pick('regular');
    window.__viewer.set('models', 3);
    const u = window.__viewer.unit();
    return { models: u.models, morale: window.PMC.currentMorale(u) };
  });
  ok('losing models drops the unit\'s Morale', shrunk.models === 3 && shrunk.morale < 5,
    shrunk.models + ' models, Morale ' + shrunk.morale);

  /* ---------------------------------------------------------------- running gear */
  head('Vehicles open with no optional propulsion, drawn on their usual running gear');
  const drives = await p.evaluate(() => ['hpv', 'lcv', 'acv'].map(k => {
    window.__viewer.pick(k);
    return k + ':' + document.querySelector('[data-set="prop"].on').textContent;
  }));
  ok('every hull opens on "none" — the printed profile',
    drives.join(' ') === 'hpv:none lcv:none acv:none', drives.join(' '));
  const looks = await p.evaluate(() => ['hpv', 'lcv', 'acv'].map(k => k + ':' + window.PMC.lookDrive(window.PMC.profile(k))));
  ok('...drawn wheeled, tracked and anti-grav', looks.join(' ') === 'hpv:wheeled lcv:tracked acv:grav', looks.join(' '));
  ok('the stage has no tap highlight', await p.evaluate(() => getComputedStyle(document.getElementById('vboard')).webkitTapHighlightColor === 'rgba(0, 0, 0, 0)'));
  await p.evaluate(() => window.__viewer.pick('regular'));

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

  /* ------------------------------------------------ Underground Bugs burrow */
  head('Underground Bugs burrow along the bench instead of walking');
  await p.evaluate(() => window.__viewer.pick('bhugeunder'));
  await p.evaluate(() => window.__viewer.walk());
  const seenB = { sink: false, hidden: false };
  for (let i = 0; i < 60; i++) {
    const bw = await p.evaluate(() => window.__viewer.burrow());
    if (bw && !bw.hidden && bw.alpha < 0.9) seenB.sink = true;   // fading out as it goes down
    if (bw && bw.hidden) seenB.hidden = true;
    await p.waitForTimeout(40);
  }
  await p.evaluate(() => window.__viewer.walk());
  ok('they fade out as they go down', seenB.sink);
  ok('...and along under it, out of sight', seenB.hidden);
  await p.evaluate(() => window.__viewer.pick('regular'));

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

  /* Expendable (p. 57): broken, a penal squad goes the way it does in the
     battle — each man's collar blinks and fires as he runs, then he falls. */
  console.log('\n  penal troops, broken: the collars');
  await p.evaluate(() => { window.__viewer.pick('penal'); window.__viewer.set('status', 'broken'); });
  await p.waitForTimeout(420);
  const mid = await p.evaluate(() => {
    const st = window.__viewer.state(), now = performance.now();
    return { blasts: window.__viewer.fx().filter((k) => k === 'collar').length,
      standing: st.collar ? st.collar.at.filter((t) => t > now).length : -1, n: st.collar ? st.collar.pts.length : 0 };
  });
  await p.screenshot({ path: path.join(SHOTS, 'viewer-collars.png') });
  ok('every man\'s collar goes off', mid.blasts === mid.n && mid.n === 8, mid.blasts + ' of ' + mid.n);
  ok('...on men still standing, a few at a time', mid.standing > 0 && mid.standing < mid.n, mid.standing + ' still standing');
  // (the first goes off standing; the rest bolt and go off as they run: about 3s from first blink to last smoke)
  await p.waitForTimeout(2800);
  const end = await p.evaluate(() => {
    const st = window.__viewer.state(), now = performance.now();
    return { standing: st.collar.at.filter((t) => t > now).length, fx: window.__viewer.fx().length };
  });
  ok('...until all are down', end.standing === 0 && end.fx === 0);
  // destroyed is the squad lying dead, with no collars going off
  await p.evaluate(() => window.__viewer.destroy());
  await p.waitForTimeout(200);
  const dead = await p.evaluate(() => ({ collar: !!window.__viewer.state().collar, blasts: window.__viewer.fx().filter((k) => k === 'collar').length }));
  ok('destroyed, a penal squad just lies dead', !dead.collar && dead.blasts === 0, JSON.stringify(dead));
  await p.evaluate(() => window.__viewer.set('status', 'broken'));
  await p.waitForTimeout(100);
  const again = await p.evaluate(() => {
    const st = window.__viewer.state(), now = performance.now();
    return { blasts: window.__viewer.fx().filter((k) => k === 'collar').length, standing: st.collar.at.filter((t) => t > now).length };
  });
  ok('Broken pressed again plays it over', again.blasts === 8 && again.standing === 8, JSON.stringify(again));
  await p.evaluate(() => window.__viewer.pick('regular'));
  ok('another unit is not left mid-detonation', !(await p.evaluate(() => window.__viewer.state().collar)));

  console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
  console.log('page errors: ' + (errs.join(' | ') || 'none'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
