/* Story mode through the interface, from a new story to the end of chapter 1
   (docs/story-mode-plan.md, section 6): the menu's Story card, the founding,
   the chapter card, an event, the battle's briefing and the muster, the
   battle started with the story's own cfg, its result, the aftermath and the
   debrief, the journal, and the story kept in the Continue list. The battle is
   not played: the enemy concedes it as soon as it is under way. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, seedDice } = require('../where.js');

async function body(p) { return p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText); }
async function go(p, sel) {
  const hit = await p.evaluate((s) => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, sel);
  await p.waitForTimeout(250);
  return hit;
}
async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(250);
  return hit;
}
async function cards(p) {
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => { const r = document.getElementById('resolution'); if (r && !r.hidden) document.getElementById('res-continue').click(); });
    await p.waitForTimeout(150);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await seedDice(p, 2670);
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload(); await p.waitForTimeout(800);

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }

  console.log('\nA new story');
  check('the menu has a Story card', await p.evaluate(() => !!document.getElementById('btn-story')));
  await go(p, '#btn-story');
  let txt = await body(p);
  check('it opens the new-story form, Deep Contract offered', /Story/.test(txt) && /Deep Contract/.test(await p.evaluate(() => document.getElementById('story-pick').innerHTML)), txt.slice(0, 120));
  check('...with ironman to choose, for good', /Ironman/.test(txt));
  await go(p, '[data-go="storynew"]');
  check('the campaign’s own founding screen comes up', await p.evaluate(() => !!document.getElementById('found-name')));
  const cmd0 = await p.evaluate(() => { const b = document.getElementById('found-commander'); return b ? b.value : null; });
  check('...with a box for the commander\u2019s name under the company\u2019s, already filled in', !!cmd0 && cmd0.trim().length > 3, cmd0);
  await p.evaluate(() => { document.getElementById('found-name').value = 'Kessler Rifles'; document.getElementById('found-commander').value = 'Mara Okafor'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) await go(p, `#camp-body button[data-add="${k}"]`);
  await go(p, '#camp-body button[data-doc="S2"]');
  check('the charter is signed', await clickText(p, 'Sign the charter'));

  console.log('\nChapter 1');
  txt = await body(p);
  check('the story begins: Deep Contract, Landfall', /Deep Contract/.test(txt) && /Landfall/.test(txt), txt.slice(0, 160));
  check('...on the chapter’s card', await p.evaluate(() => !!document.querySelector('#camp-body .story-card')));
  check('the commander is named in the story: Second Lieutenant Okafor', /Mara Okafor is on the first shuttle/.test(txt) && /addressed to Second Lieutenant Okafor/.test(txt), txt.slice(0, 600));
  const officer = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(), co = c.companies.A, e = co.roster.find((x) => x.rid === co.cmdRid); return e && e.men && e.men[0]; });
  check('...and is the officer at the head of the command squad', officer && officer.name === 'Mara Okafor', JSON.stringify(officer));
  check('...with the meters the company can see (and not the hidden ones)', /HTX Standing/.test(txt) && /Loyalty/.test(txt) && !/Hive Growth/.test(txt));
  const camp0 = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { mode: c.mode, rivals: (c.rivals || []).length, story: c.story && c.story.id }; });
  check('a solo dossier with the story on it, and no rivals raised', camp0.mode === 'solo' && camp0.story === 'deep-contract' && camp0.rivals <= 1, JSON.stringify(camp0));
  await go(p, '[data-go="storyon"]');
  txt = await body(p);
  check('the brief leads to the event: the port master’s offer', /port master/i.test(txt) && await p.evaluate(() => document.querySelectorAll('#camp-body .story-opt').length === 3));
  await p.screenshot({ path: path.join(SHOTS, 'story-event.png') });
  await go(p, '[data-go="storyopt"][data-o="ask"]');
  await p.screenshot({ path: path.join(SHOTS, 'story-briefing.png') });
  txt = await body(p);
  check('asking what they know: the mission’s briefing: its name, its ground, the story of it, then the rules and the enemy', /Hold the Port/i.test(txt) && /starport/i.test(txt) && /Front is coming through the terminal/.test(txt) && /Secure and control/i.test(txt) && /Battle Tier I/.test(txt) && /The enemy, as you know them/i.test(txt), txt.slice(0, 300));
  check('...and, having asked, an outline of the enemy (not every unit)', /You have their outline/.test(txt) && /bands of fighters/.test(txt) && !/Word is:/.test(txt), txt.slice(txt.indexOf('The enemy'), txt.indexOf('The enemy') + 200));
  await go(p, '[data-go="storymuster"]');
  txt = await body(p);
  check('the muster picks a legal force for the battle', /A legal army/.test(txt) && await p.evaluate(() => !document.querySelector('[data-go="storyfight"]').disabled), txt.slice(0, 200));
  await go(p, '[data-go="storyfight"]');
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => { const s = window.PMC_STATE && window.PMC_STATE(); return s ? { node: s.cfg.story && s.cfg.story.node, scen: s.cfg.scenario, b: s.units.filter(u => u.side === 'B').length } : null; });
  check('the battle starts with the story’s cfg', st && st.node === 'c1.battle' && st.scen === 'secure' && st.b > 0, JSON.stringify(st));
  const ground = await p.evaluate(() => { const s = window.PMC_STATE(); return { name: s.scen.name, book: s.scen.bookName, pads: s.terrain.filter((t) => t.kind === 'road').length, header: (document.getElementById('hdr-init') || {}).textContent }; });
  check('...on the starport, under the mission\u2019s own name', ground.name === 'Hold the Port' && ground.book === 'Secure and control' && ground.pads === 3, JSON.stringify(ground));
  await cards(p);
  // the mission's card (its name, its briefing, the pads by name) put away, to see the ground
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^done$/i.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(SHOTS, 'story-board.png') });

  // the enemy concedes: a result without a battle played
  await cards(p);
  await p.evaluate(() => window.__concede('B'));
  await p.waitForTimeout(500);
  await cards(p);
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => !document.getElementById('camp').hidden)) break;
    await cards(p);
    await p.waitForTimeout(300);
  }
  const after = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { node: c.story.node, grade: c.story.lastGrade, pending: !!c.pending }; });
  check('the result moved the story on: to the debrief', after.node === 'c1.debrief' && /decisive|victory/.test(after.grade), JSON.stringify(after));
  // Tough Negotiators first, then the aftermath, as for any campaign battle
  await clickText(p, '^[Kk]eep them all$');
  await p.waitForTimeout(400);
  txt = await body(p);
  check('the campaign’s own aftermath follows', /Aftermath/.test(txt) && /kUC/.test(txt));
  check('...with no other forces’ battles fought out of sight', !/Elsewhere on the world/i.test(txt));
  await p.evaluate(() => { const b = document.querySelector('#camp-body [data-go="afterhub"]'); if (b) b.click(); });
  await p.waitForTimeout(300);
  txt = await body(p);
  check('...and then the debrief, with the grade', /Victory|Decisive/.test(txt) && await p.evaluate(() => !!document.querySelector('#camp-body .story-grade')), txt.slice(0, 200));
  await go(p, '[data-go="storyon"]');
  txt = await body(p);
  check('the debrief’s event: the dead at the gate', /dead at the gate/i.test(txt));
  await go(p, '[data-go="storyopt"][data-o="bury"]');
  txt = await body(p);
  check('...and on to the interlude, with the way to the company', /company/i.test(txt) && await p.evaluate(() => !!document.querySelector('#camp-body [data-go="hub"]')));
  check('...and a side contract on offer, with its pay', /Side contracts/i.test(txt) && /kUC/.test(txt) && await p.evaluate(() => !!document.querySelector('#camp-body [data-go="storyside"]')), txt.slice(0, 200));
  await p.screenshot({ path: path.join(SHOTS, 'story-side.png'), fullPage: true });

  console.log('\nThe journal, and coming back');
  await go(p, '[data-go="storyjournal"]');
  txt = await body(p);
  check('the journal tells chapter 1: the choices and the battle', /Landfall/i.test(txt) && /Ask what he knows/i.test(txt) && /Victory|Decisive/i.test(txt), txt.slice(0, 300));
  check('...and offers the chapter’s start to go back to', await p.evaluate(() => document.querySelectorAll('#camp-body [data-go="storyrewind"]').length >= 1));
  await go(p, '.camp-foot [data-go="story"]');
  await go(p, '#camp-body [data-go="hub"]');
  check('the company’s hub has the way back to the story', await p.evaluate(() => !!document.querySelector('#camp-body .hubtake [data-go="story"]')));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => window.PMCMenu.open()); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('btn-continue').click()); await p.waitForTimeout(300);
  const row = await p.evaluate(() => { const b = document.querySelector('#cont-list [data-cont^="c:"]'); return b ? b.textContent : ''; });
  check('the Continue list keeps it, as a Story', /Story/.test(row) && /Deep Contract/.test(row), row);
  await p.evaluate(() => document.querySelector('#cont-list [data-cont^="c:"]').click()); await p.waitForTimeout(900);
  txt = await body(p);
  check('...and goes back to where the story was', /Deep Contract/.test(txt) && await p.evaluate(() => window.PMC_CAMPAIGN.get().story.chapter === 'c1'), txt.slice(0, 120));
  await p.screenshot({ path: path.join(SHOTS, 'story-interlude.png') });

  console.log('\nThe ending');
  // the story taken to an ending as it stands (the second half is not played here): its screen
  await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); c.story.flags.varga_dead = true; c.story.flags.pit9_spared = true; c.story.ended = 'paidoff'; c.story.node = null; });
  await go(p, '#camp-body [data-go="hub"]');
  await go(p, '#camp-body .hubtake [data-go="story"]');
  txt = await body(p);
  check('the ending\u2019s screen: its title and text, the epilogue, and who stayed', /Paid Off/i.test(txt) && /Pit Four/.test(txt) && /school was open again/.test(txt) && /Who stayed/i.test(txt) && /from the first day/.test(txt), txt.slice(0, 400));
  await p.screenshot({ path: path.join(SHOTS, 'story-ending.png'), fullPage: true });

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + (problems.length ? problems.length + ' failed: ' + problems.join('; ') : 'All passed.'));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
