/* Dead Reckoning through the interface (docs/story-dead-reckoning-plan.md,
   phase 3): picked on the new-story form, founded, and played from Lot 47 into
   chapter 2. Chapter 1's card and Vane's conversation, the bidding, the
   battle's briefing and the market square it is fought on, the battle started
   with the story's own cfg, its result and the debrief, Kettering's call, the
   jump, and chapter 2's two readings as far as the Glass Flats' briefing. The
   battle is not played: the enemy concedes it as soon as it is under way. */
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
const talkOf = (p) => p.evaluate(() => [...document.querySelectorAll('#camp-body .story-talk .story-line')].map((l) => ({ who: l.querySelector('b').textContent, face: !!l.querySelector('.talk-face svg'), mine: l.classList.contains('mine') })));

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', e => { errs.push(e.message); if (process.env.STACK) console.log(e.stack.split('\n').slice(0, 25).join('\n')); });
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

  console.log('\nA new story: Dead Reckoning');
  await go(p, '#btn-story');
  check('the new-story form offers Dead Reckoning beside Deep Contract', await p.evaluate(() => { const s = document.getElementById('story-pick'); return !!s && [...s.options].map((o) => o.value).join() === 'deep-contract,dead-reckoning'; }));
  await p.evaluate(() => { const s = document.getElementById('story-pick'); s.value = 'dead-reckoning'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(250);
  let txt = await body(p);
  check('...picked: its own blurb, Morrow’s log and Lucan Vane, whom nobody sees', /surveyor/.test(txt) && /Lucan Vane/.test(txt) && /seen by almost nobody/.test(txt), txt.slice(0, 200));
  await go(p, '[data-go="storynew"]');
  await p.evaluate(() => { document.getElementById('found-name').value = 'Morrow’s Own'; document.getElementById('found-commander').value = 'Ines Okoro'; });
  for (const k of ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng']) await go(p, `#camp-body button[data-add="${k}"]`);
  await go(p, '#camp-body button[data-doc="S2"]');
  check('the charter is signed', await clickText(p, 'Sign the charter'));

  console.log('\nChapter 1: Lot 47');
  txt = await body(p);
  check('the story begins: Dead Reckoning, Lot 47, the first half The Chart', /Dead Reckoning/.test(txt) && /Lot 47/.test(txt) && /Chapter 1 · The Chart/i.test(txt), txt.slice(0, 200));
  check('...the chapter’s prose: Morrow, the auction, Vesk', /Elias Morrow/.test(txt) && /Vesk Free Port/.test(txt));
  const talk = await talkOf(p);
  check('...and Vane’s conversation: Vane on the line, his reader and the commander, each with a face', talk.length >= 6 && talk.every((l) => l.face) && /Vane/.test(talk[0].who) &&
    talk.some((l) => /Halloran/.test(l.who)) && talk.some((l) => l.mine), JSON.stringify(talk.map((l) => l.who)));
  check('...the commander named in it', /Second Lieutenant Okoro\. This is Lucan Vane/.test(txt), txt.slice(txt.indexOf('Lucan Vane.') - 60, txt.indexOf('Lucan Vane.') + 40));
  check('...and the meters the company can see: Vane’s Trust, Lead, Lodestones (not Alarm)', /Vane’s Trust/.test(txt) && /Lead/.test(txt) && /Lodestones/.test(txt) && !/Alarm/.test(txt));
  await p.screenshot({ path: path.join(SHOTS, 'dr-chapter.png') });
  await go(p, '[data-go="storyon"]');
  txt = await body(p);
  check('the brief leads to the bidding: three ways to play the room, with Vane’s face', /bidding/i.test(txt) && /Moss Kettering/.test(txt) &&
    await p.evaluate(() => document.querySelectorAll('#camp-body .story-opt').length === 3 && !!document.querySelector('#camp-body .story-who svg.story-portrait')), txt.slice(0, 200));
  await go(p, '[data-go="storyopt"][data-o="watch"]');
  txt = await body(p);
  check('watching the room: the mission’s briefing, Lot 47 in the market square, an Escort: Halloran to the landing field', /Lot 47/.test(txt) && /market square/.test(txt) && /landing field/.test(txt) && /Escort/.test(txt), txt.slice(0, 300));
  await go(p, '[data-go="storymuster"]');
  await go(p, '[data-go="storyfight"]');
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => { const s = window.PMC_STATE && window.PMC_STATE(); return s ? { node: s.cfg.story && s.cfg.story.node, scen: s.cfg.scenario, planet: s.cfg.planet, vane: (s.units.find((u) => u.escort) || {}).name, map: s.cfg.story.mapName, kettle: s.units.filter((u) => u.side === 'B').length } : null; });
  check('the battle starts with the story’s cfg: c1.battle, an Escort, Brass Ledger', st && st.node === 'c1.battle' && st.scen === 'escort' && st.kettle > 0, JSON.stringify(st));
  check('...on Vesk’s market square, with Halloran on the table, the company’s to get across', st && /Vesk/.test(st.map) && st.vane === 'Halloran', JSON.stringify(st));
  await cards(p);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^done$/i.test(x.textContent.trim()) && x.offsetParent); if (b) b.click(); });
  await p.waitForTimeout(800);
  await cards(p);
  await p.screenshot({ path: path.join(SHOTS, 'dr-board.png') });
  await p.evaluate(() => window.__concede('B'));
  await p.waitForTimeout(500);
  for (let i = 0; i < 20; i++) {
    if (await p.evaluate(() => !document.getElementById('camp').hidden)) break;
    await cards(p);
    await p.waitForTimeout(300);
  }
  const after = await p.evaluate(() => { const c = window.PMC_CAMPAIGN.get(); return { node: c.story.node, grade: c.story.lastGrade }; });
  check('the result moved the story on: to the debrief', after.node === 'c1.debrief' && /decisive|victory/.test(after.grade), JSON.stringify(after));
  await clickText(p, '^[Kk]eep them all$');
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('#camp-body [data-go="afterhub"]'); if (b) b.click(); });
  await p.waitForTimeout(300);
  txt = await body(p);
  check('the debrief: Brass Ledger melt back into the market', /melt back into the market/.test(txt), txt.slice(0, 200));
  await go(p, '[data-go="storyon"]');
  txt = await body(p);
  const call = await talkOf(p);
  check('Kettering calls about his man, and the agent’s three fates are offered', call.some((l) => /Kettering/.test(l.who)) && /hands tied/.test(txt) &&
    await p.evaluate(() => document.querySelectorAll('#camp-body .story-opt').length === 3), JSON.stringify(call.map((l) => l.who)));
  await go(p, '[data-go="storyopt"][data-o="message"]');
  txt = await body(p);
  check('...and on to the jump: Vane’s first heading on the board', /first heading/.test(txt), txt.slice(0, 200));
  const chart = await p.evaluate(() => { const c = document.querySelector('#camp-body .story-chart'); return c ? { map: !!c.querySelector('svg.story-chart-map rect'), text: c.innerText } : null; });
  check('...with the star chart: Vesk the first stop, Brass Ledger met there, the next heading still to come, the lodestones held',
    chart && chart.map && /Vesk/.test(chart.text) && /met Brass Ledger/.test(chart.text) && /next heading/.test(chart.text) && /0 held/.test(chart.text), chart && chart.text.slice(0, 200));
  await p.evaluate(() => document.querySelector('#camp-body .story-chart').scrollIntoView());
  await p.screenshot({ path: path.join(SHOTS, 'dr-interlude.png') });

  console.log('\nChapter 2: The First Lodestone');
  // the interlude's event answered (whichever it is), and on to the next chapter
  for (let i = 0; i < 6; i++) {
    const t = await body(p);
    if (/First Lodestone/.test(t)) break;
    if (!(await go(p, '[data-go="storyopt"]:not([disabled])'))) await go(p, '[data-go="storyon"]');
  }
  txt = await body(p);
  check('the jump to chapter 2: two readings of Morrow’s first heading', /The First Lodestone/.test(txt) && /Glass under me/.test(txt), txt.slice(0, 200));
  check('...on a picture of the Glass Flats', await p.evaluate(() => { const i = document.querySelector('#camp-body .story-card img.story-scene'); return !!i && /^data:image\/png/.test(i.src); }));
  check('...talked over with Vane’s reader', (await talkOf(p)).some((l) => /Halloran/.test(l.who)));
  await go(p, '[data-go="storyon"]');
  await go(p, '[data-go="storyopt"][data-o="flats"]');
  txt = await body(p);
  check('the Glass Flats: Wraith Section already on the dig, and Nine on the open channel', /Wraith Section/.test(txt) && (await talkOf(p)).some((l) => /Nine/.test(l.who)), txt.slice(0, 200));
  await go(p, '[data-go="storyopt"][data-o="night"]');
  txt = await body(p);
  check('...its briefing: three dig sites, a lodestone to carry home, light gravity', /The Glass Flats/.test(txt) && /lodestone/.test(txt) && /carried home/.test(txt) && /gravity/i.test(txt), txt.slice(0, 400));

  check('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n' + (problems.length ? problems.length + ' failed: ' + problems.join('; ') : 'All passed.'));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
