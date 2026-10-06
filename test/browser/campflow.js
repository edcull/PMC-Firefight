/* A campaign played through the interface: found a company, take a contract,
   fight the battle, read the aftermath, spend the pay — then do it again, and
   check the dossier remembers everything in between. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS, seedDice } = require('../where.js');

const shots = [];
async function shot(p, name) {
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOTS, name) });
  shots.push(name);
}
async function body(p) { return p.evaluate(() => document.getElementById('camp-title').textContent + '\n' + document.getElementById('camp-body').innerText); }
async function click(p, sel) {
  const hit = await p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, sel);
  await p.waitForTimeout(220);
  return hit;
}
// the dossier's unit cards: tap the lit tab to go back to them
async function toUnits(p) {
  await p.evaluate(() => { const b = document.querySelector('#camp-body [data-rtab="units"]') || document.querySelector('#camp-body .cmodal:not([hidden]) [data-go="fmodalclose"]'); if (b) b.click(); });
  await p.waitForTimeout(220);
}

async function clickText(p, re) {
  const hit = await p.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll('#camp-body button')].find(x => rx.test(x.textContent) && !x.disabled);
    if (!b) return false;
    b.click(); return true;
  }, re);
  await p.waitForTimeout(220);
  return hit;
}

/* The other forces' battles are fought out after yours and reported at the
   foot of the aftermath; its Dossier button waits for them. Wait them out,
   and say whether their reports came up. */
async function pastFronts(p) {
  for (let i = 0; i < 600; i++) {
    const at = await p.evaluate(() => {
      const b = document.querySelector('#camp-body .camp-dock [data-go="afterhub"]');
      if (!b) return 'none';
      if (b.disabled) return 'fighting';
      return document.querySelectorAll('#camp-body .cpan.front').length ? 'reported' : 'none';
    });
    if (at !== 'fighting') return at === 'reported';
    await p.waitForTimeout(250);
  }
  return false;
}

(async () => {
  const b = await chromium.launch({ executablePath: require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await seedDice(p, 2670);          // the same battles, and the same experience from them, every run
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { localStorage.removeItem('pmc-campaign'); } catch (e) { } });

  const problems = [];
  function check(name, cond, note) {
    console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
    if (!cond) problems.push(name);
  }

  /* ---------------------------------------------------------- founding */
  console.log('\nFounding a company');
  await click(p, '#btn-campaign');
  await clickText(p, 'Raise the force');
  check('the founding screen opened', await p.evaluate(() => !!document.getElementById('found-name') && /PMC/.test(document.querySelector('#camp-body .found-units .muster-head .armypill').textContent)));
  // the name and the colours are settled here now, with the units
  await p.evaluate(() => { document.getElementById('found-name').value = 'Task Force Ironhold'; });
  check('...and asks for the company name there',
    await p.evaluate(() => !!document.getElementById('found-name')));
  check('...and for its colours',
    await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); return document.querySelectorAll('#camp-body [data-campcolour]').length > 1; }));

  check('founding marks Penal troops as free with the gift tag', await p.evaluate(() => {
    const pen = document.querySelector('#camp-body button[data-add="penal"]'), rec = document.querySelector('#camp-body button[data-add="recruits"]');
    return !!pen && !!pen.querySelector('.freemark') && !!rec && !rec.querySelector('.freemark');
  }));
  // six Tier I, two Tier II, one of them a vehicle
  const picks = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
  for (const k of picks) {
    const got = await click(p, `#camp-body button[data-add="${k}"]`);
    if (!got) problems.push('could not add ' + k);
  }
  let txt = await body(p);
  check('the counter reads six and two', /6\/6 Tier I/.test(txt) && /2\/2 Tier II/.test(txt),
    txt.match(/\d\/6 Tier I.*?vehicles/s)?.[0]);
  await click(p, '#camp-body button[data-doc="S2"]');
  await shot(p, 'camp-found.png');
  check('the charter can be signed', await clickText(p, 'Sign the charter'));

  txt = await body(p);
  check('the hub shows the new company', /Task Force Ironhold/.test(txt));
  // each unit is named by its place among its kind: 1st Recruits; the command keeps its plain name
  const named = await p.evaluate(() => { const co = window.PMC_CAMPAIGN.get().companies.A; return co.roster.map(e => (e.rid === co.cmdRid ? 'C:' : '') + e.name); });
  check('new units are named by their place: 1st Recruits, 1st Enforcers…', named.filter(n => !/^C:/.test(n)).every(n => /^1st /.test(n)) && named.some(n => /^C:Field command/.test(n)), named.join(', '));
  check('...at Company Tier I', await p.evaluate(() => (document.querySelector('#camp-body .cpan-A .tierbadge') || {}).textContent === 'I'));
  check('...with nine units', await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length === 9));
  check('...win rate, honours and trauma in one row', await p.evaluate(() => document.querySelectorAll('#camp-body .cpan-A .cstats .cstat').length === 3));
  check('...and the page itself does not scroll', await p.evaluate(() => { const b = document.getElementById('camp-body'); return b.scrollHeight <= b.clientHeight + 1; }));
  const rival = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return { name: c.companies.B.name, arch: c.companies.B.archetype, units: c.companies.B.roster.length };
  });
  check('...and a rival founded alongside', !!rival.arch && rival.units === 9,
    rival.name + ', ' + rival.arch + ', ' + rival.units + ' units');
  check('...whose panel the hub lists', await p.evaluate((n) => [...document.querySelectorAll('#camp-body .cpan-B .cphead b')].some(b => b.textContent === n), rival.name), rival.name);
  await shot(p, 'camp-hub.png');

  // with a campaign under way (and no battle on), the menu's first card is Continue, and it is in the list behind it
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => window.PMCMenu.open()); await p.waitForTimeout(300);
  const resume = await p.evaluate(() => ({ shown: !document.getElementById('btn-continue').hidden,
    first: document.querySelector('#menu-main .mcard:not([hidden])').id, sub: document.getElementById('menu-continue-sub').textContent }));
  check('the menu opens on Continue', resume.shown && resume.first === 'btn-continue' && /Task Force/.test(resume.sub), JSON.stringify(resume));
  await p.evaluate(() => document.getElementById('btn-continue').click()); await p.waitForTimeout(300);
  const crow = await p.evaluate(() => { const b = document.querySelector('#cont-list [data-cont^="c:"]'); return b ? b.textContent : ''; });
  check('...a list with the campaign in it', /Campaign/.test(crow) && /Task Force/.test(crow) && /campaign turn/.test(crow), crow);
  await p.evaluate(() => document.querySelector('#cont-list [data-cont^="c:"]').click()); await p.waitForTimeout(800);
  check('...which goes back to its hub', await p.evaluate(() => !document.getElementById('camp').hidden && !!document.querySelector('#camp-body .cpan-A')));

  /* the road to the next Company Tier, laid out step by step (pp. 83-84) —
     behind the Company button, the hub opening on the dossier */
  check('the hub opens on the company', await p.evaluate(() => !document.querySelector('#camp-body .cdos') && !!document.querySelector('#camp-body .cpan-A .cstats')));
  // the dossier: the units alone, under one line of sort and filter
  await p.evaluate(() => document.querySelector('#camp-body .hubbar [data-go="roster"]').click());
  await p.waitForTimeout(200);
  const dos = await p.evaluate(() => ({ cdos: !!document.querySelector('#camp-body .cdos'), stats: !!document.querySelector('#camp-body .cpan-A .cstats'),
    creed: !!document.querySelector('#camp-body .cpan-A .cpdoc'), line: [...document.querySelectorAll('#camp-body .dsortline button')].map(b => b.textContent) }));
  check('the dossier shows the units, without the figures, army and creed', dos.cdos && !dos.stats && !dos.creed, JSON.stringify(dos));
  check('...under a line to sort and filter them', dos.line.length === 2 && /Sort: Type/.test(dos.line[0]) && /Filter: All/.test(dos.line[1]), dos.line.join(' | '));
  // grouped from the start: a header over each unit type, the command's first
  // (the Group tick box is in the sort's pop-up)
  const heads = await p.evaluate(() => {
    document.querySelector('#camp-body .dsortline [data-kind="dsort"]').click();
    const box = document.querySelector('#camp-body .dpop .dgrpchk'), on = box ? box.getAttribute('aria-checked') : null;
    document.querySelector('#camp-body .dsortline [data-kind="dsort"]').click();
    return { on, heads: [...document.querySelectorAll('#camp-body .cdos .dgrouphead')].map(h => h.textContent) };
  });
  check('...grouped by type from the start, under headers, the command first', heads.on === 'true' && heads.heads.length > 2 && heads.heads[0] === 'Command', JSON.stringify(heads));
  await p.evaluate(() => { document.querySelector('#camp-body .dsortline [data-kind="dsort"]').click(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { document.querySelector('#camp-body .dpop [data-by="name"]').click(); });   // a pick puts the sort away
  await p.waitForTimeout(150);
  const sortedNames = await p.evaluate(() => {
    const camp = window.PMC_CAMPAIGN.get(), rids = [...document.querySelectorAll('#camp-body .cdos .dcard[data-rid]')].map(b => b.getAttribute('data-rid'));
    return rids.map(r => camp.companies.A.roster.find(e => String(e.rid) === r).name);
  });
  check('Sort by name puts them in order of name', sortedNames.length > 3 && sortedNames.every((n, i) => !i || sortedNames[i - 1].localeCompare(n) <= 0), sortedNames.join(', '));
  check('...and the sort, a pop-up under its button, is put away once picked', await p.evaluate(() => !document.querySelector('#camp-body .dpop')));
  await p.evaluate(() => { document.querySelector('#camp-body .dsortline [data-kind="dfilter"]').click(); });
  await p.waitForTimeout(150);
  const filt = await p.evaluate(() => {
    const b = document.querySelector('#camp-body .dpop [data-go="dfilt"][data-kind="tier"]');
    const tier = +b.getAttribute('data-val'); b.click();
    const camp = window.PMC_CAMPAIGN.get(), rids = [...document.querySelectorAll('#camp-body .cdos .dcard[data-rid]')].map(x => x.getAttribute('data-rid'));
    const tiers = rids.map(r => window.PMC.profile(camp.companies.A.roster.find(e => String(e.rid) === r).key).tier);
    return { tier, tiers, label: document.querySelector('#camp-body .dsortline [data-kind="dfilter"]').textContent };
  });
  check('Filter by Tier narrows it to that Tier', filt.tiers.length > 0 && filt.tiers.every(t => t === filt.tier) && /Tier/.test(filt.label), JSON.stringify(filt));
  check('the filter stays open while ticked, under its button', await p.evaluate(() => { const w = document.querySelector('#camp-body .dsortline [data-kind="dfilter"]').parentNode; return !!w.querySelector('.dpop'); }));
  await p.evaluate(() => { document.querySelector('#camp-body .dpop [data-go="dfiltclear"]').click(); });
  // grouped, by what was last filtered: Tier headers over a Tier filter; then the toggle takes the headers away
  const byTier = await p.evaluate(() => {
    document.querySelector('#camp-body .dpop [data-go="dfilt"][data-kind="tier"]').click();
    const heads = [...document.querySelectorAll('#camp-body .cdos .dgrouphead')].map(h => h.textContent);
    document.querySelector('#camp-body .dpop [data-go="dfiltclear"]').click();
    document.querySelector('#camp-body .dsortline [data-kind="dsort"]').click();
    document.querySelector('#camp-body .dpop .dgrpchk').click();
    const off = document.querySelectorAll('#camp-body .cdos .dgrouphead').length;
    document.querySelector('#camp-body .dpop .dgrpchk').click();
    return { heads, off };
  });
  check('a Tier filter, grouped, puts Tier headers over the list; the Group tick box takes them away', byTier.heads.length === 1 && /^Tier /.test(byTier.heads[0]) && byTier.off === 0, JSON.stringify(byTier));
  await p.evaluate(() => document.querySelector('#camp-body .cphead').click());   // a tap elsewhere puts it away
  await p.waitForTimeout(100);
  check('...and a tap elsewhere puts it away', await p.evaluate(() => !document.querySelector('#camp-body .dpop')));
  await p.evaluate(() => { const b = document.querySelector('#camp-body .hubtabs [data-go="roster"]:first-child'); if (b) b.click(); });
  await p.waitForTimeout(200);
  // folded to one line (the next Tier and how far along), opened by a tap
  const fold = await p.evaluate(() => {
    const el = document.querySelector('#camp-body .cprom');
    const shut = !!el && !el.querySelector('.cprom-list') && !!el.querySelector('.cprom-toggle .cprom-bar');
    el.querySelector('.cprom-toggle').click();
    const now = document.querySelector('#camp-body .cprom');
    return { shut, opened: !!now.querySelector('.cprom-list li') };
  });
  check('the promotion checklist is one line, opening on a tap', fold.shut && fold.opened, JSON.stringify(fold));
  const prom = await p.evaluate(() => {
    const el = document.querySelector('#camp-body .cprom');
    if (!el) return { none: true };
    const steps = [...el.querySelectorAll('.cprom-list li')];
    return {
      head: el.querySelector('.cprom-head b').textContent,
      count: el.querySelector('.cprom-count').textContent,
      steps: steps.map(li => li.className + ': ' + li.querySelector('b').textContent),
      details: steps.map(li => li.querySelector('em').textContent),
      buttonDead: el.querySelector('.cprom-go').disabled,
      buttonText: el.querySelector('.cprom-go').textContent
    };
  });
  check('the dossier shows the road to the next Tier', !prom.none && /Tier II/.test(prom.head),
    prom.head + ' — ' + prom.count);
  check('...with every requirement listed', prom.steps.length === 3, prom.steps.join(' | '));
  check('...marked met or unmet', prom.steps.some(s => /^met/.test(s)) && prom.steps.some(s => /^unmet/.test(s)),
    prom.steps.filter(s => /^met/.test(s)).length + ' met');
  check('...and each one says what is short', prom.details.every(d => d.length > 5),
    prom.details.find(d => /Needs|short/.test(d)) || prom.details[0]);
  check('the promote button is dead until they are all met', prom.buttonDead,
    prom.buttonText.trim());

  // give it the money and the missing unit, and the button should come alive
  const live = await p.evaluate(() => {
    const C = window.PMCCamp, camp = window.PMC_CAMPAIGN.get();
    camp.companies.A.kUC = 60;
    const prog = C.promotionProgress(camp.companies.A);
    // recruit whatever Tier the report says is short, until it is not
    for (let g = 0; g < 8; g++) {
      const p2 = C.promotionProgress(camp.companies.A);
      if (p2.ok) break;
      const gap = p2.steps.find(x => !x.done && x.id !== 'money');
      if (!gap) break;
      const want = +(gap.detail.match(/Tier (I+V?|V)/) ? 0 : 0);
      const tier = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[(gap.detail.match(/Tier (I+V?|V)\b/) || [])[1]] || 2;
      const pick = window.PMC.listFor(camp.companies.A.faction)
        .filter(q => q.tier === tier && !q.command && q.cls === 'infantry')[0];
      if (!pick || !C.recruit(camp.companies.A, pick.key).ok) break;
    }
    window.PMC_CAMPAIGN.set(camp);
    const el = document.querySelector('#camp-body .cprom');
    return {
      ok: C.promotionProgress(camp.companies.A).ok,
      dead: el ? el.querySelector('.cprom-go').disabled : null,
      text: el ? el.querySelector('.cprom-go').textContent.trim() : null,
      ready: el ? el.className : null
    };
  });
  check('...and comes alive once they are', live.ok && !live.dead, live.text);
  check('...with the panel marked ready', /ready/.test(live.ready || ''), live.ready);
  const went = await p.evaluate(() => {
    const before = window.PMC_CAMPAIGN.get().companies.A.tier;
    document.querySelector('#camp-body .cprom-go').click();
    return { before: before, after: window.PMC_CAMPAIGN.get().companies.A.tier };
  });
  await p.waitForTimeout(300);
  check('pressing it promotes the company', went.after === went.before + 1,
    'Tier ' + went.before + ' → ' + went.after);
  await p.evaluate(() => { window.PMC_CAMPAIGN.get(); });
  await clickText(p, 'Back');
  await p.waitForTimeout(200);

  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('pmc-campaign:' + localStorage.getItem('pmc-campaign-current'))));
  check('the campaign was written to storage', !!saved && saved.companies.A.roster.length >= 9,
  (saved ? saved.companies.A.roster.length + ' units, Tier ' + saved.companies.A.tier : 'nothing saved'));

  /* -------------------------------------------------------- the contract */
  console.log('\nTaking a contract');
  await p.evaluate(() => { const b = document.querySelector('#camp-body .hubtabs [data-go="roster"]:first-child'); if (b) b.click(); });   // the hub opens on the dossier
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#camp-body [data-rivcontract]').click()); await p.waitForTimeout(200);   // a contract is made from the other forces
  txt = await body(p);

  /* the job, rolled with the offer and kept: who, the scenario, its size, the world
     and which side of it you are on — and nothing at all about what they will field */
  const job = () => p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get(), t = document.getElementById('camp-body').textContent.replace(/\s+/g, ' '), k = (c.offers || []).find(o => o.rival === c.facing) || {};   // the job taken: the facing force's, kept with the turn's offers
    return {
      against: /against/.test(t),
      scenario: !!k.scenario && t.includes(k.scenario.name) && !/Scenario D6/.test(t),
      size: /Battle Tier ?[IV]+ ?Priority Level ?\d/.test(t),
      world: !k.planet || k.planet === 'random' || !!document.querySelector('#camp-body .planetpill.planet-' + k.planet),
      role: /You attack|You defend|even terms/.test(t),
      // (on the page itself: the picker's window, over it, is your own force)
      composition: (() => { const cl = document.getElementById('camp-body').cloneNode(true); cl.querySelectorAll('.cmodal').forEach(m => m.remove()); return /\d+ units|Dossier/i.test(cl.textContent); })(),
      stable: JSON.stringify([c.facing, k.scenario && k.scenario.id, k.tier, k.planet])
    };
  });
  const offers = await job();
  check('the contract opens on the job, not a line saying who it is against', !offers.against, JSON.stringify(offers));
  check('...a scenario, without its die roll', offers.scenario);
  check('...and how big a fight it is', offers.size);
  check('...and the world it is fought on', offers.world);
  check('...and which side of it you are on', offers.role);
  check('nothing shows their force composition', !offers.composition);
  // leaving and picking them again must not re-roll the job
  await p.evaluate(() => document.querySelector('#camp-body [data-go="hub"]').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#camp-body [data-rivcontract]').click()); await p.waitForTimeout(200);
  const again = await job();
  check('...and the Tier, world and scenario do not change if you leave and pick them again', again.stable === offers.stable, again.stable + ' / ' + offers.stable);
  await shot(p, 'camp-offers.png');
  txt = await body(p);
  check('...nor a list of what the force still needs', !/Needs at least/.test(txt));
  /* what each unit is carrying, on the button that puts it in the list */
  const wear = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#camp-body .cu')];
    return {
      rows: rows.length,
      // down the right: TP for troops, 'command' for command units (they take none), the kind of machine for the rest
      tp: rows.filter(r => /\d+\/\d+ TP|command|vehicle|aircraft/.test((r.querySelector('.st') || {}).textContent || '')).length,
      exp: rows.filter(r => /\d+ EXP/.test(r.textContent)).length,
      sample: rows[0] ? rows[0].textContent.replace(/\s+/g, ' ').slice(0, 70) : ''
    };
  });
  check('every unit shows its Trauma Points (or what it is) down the right when picking the list', wear.rows > 0 && wear.tp === wear.rows,
    wear.tp + ' of ' + wear.rows + ' — ' + wear.sample);

  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());   // the list, filled as the rival fills its own
  await p.waitForTimeout(200);
  txt = await body(p);
  check('the list filled legally', await p.evaluate(() => {
    const b = document.querySelector('#camp-body button.start[data-go="fight"]');
    return b.getAttribute('aria-disabled') !== 'true';
  }), txt.match(/\d+ \/ \d+/)?.[0]);
  // a disabled primary button used to look exactly like a live one
  const btn = await p.evaluate(() => {
    const b = document.querySelector('#camp-body button.start[data-go="fight"]');
    const cs = getComputedStyle(b);
    return { disabled: b.getAttribute('aria-disabled') === 'true', opacity: +cs.opacity, cursor: cs.cursor };
  });
  check('the Take the field button is live on a legal list',
    !btn.disabled && btn.opacity === 1, JSON.stringify(btn));
  // and drops dead visibly on an illegal one — keep removing until it is
  for (let i = 0; i < 8; i++) {
    const stillLegal = await p.evaluate(() => {
      const b = document.querySelector('#camp-body button.start[data-go="fight"]');
      return b.getAttribute('aria-disabled') !== 'true';
    });
    if (!stillLegal) break;
    await p.evaluate(() => {
      const drop = document.querySelector('#camp-body button[data-unpick]');
      if (drop) drop.click();
    });
    await p.waitForTimeout(250);
  }
  const off = await p.evaluate(() => {
    const b = document.querySelector('#camp-body button.start[data-go="fight"]');
    const cs = getComputedStyle(b);
    // the reason is the button's tip now, shown on a press, not a line of its own
    return { disabled: b.getAttribute('aria-disabled') === 'true', opacity: +cs.opacity, cursor: cs.cursor,
      // (the muster's window keeps a faults line of its own: not on the page)
      why: b.getAttribute('data-tip'), line: [...document.querySelectorAll('#camp-body .blockwhy, #camp-body p.faults')].some(x => !x.closest('.cmodal')) };
  });
  check('...and visibly dead, with the reason as its tip, on an illegal one',
    off.disabled && off.opacity < 0.6 && off.cursor === 'not-allowed' && !!off.why && !off.line,
    off.why ? off.why.slice(0, 80) : JSON.stringify(off));
  await p.evaluate(() => window.PMC_CAMPAIGN.autopick());   // the list, filled as the rival fills its own
  await p.waitForTimeout(200);
  await p.waitForTimeout(250);
  await shot(p, 'camp-contract.png');

  /* the three asymmetric scenarios settle who attacks with the offer, which says
     so; the screen for choosing the force leaves it there */
  for (const id of ['invasion', 'demolish', 'takeover', 'meeting']) {
    const seen = await p.evaluate((id) => {
      const got = window.__forceScenario(id);
      const t = document.getElementById('camp-body').textContent.replace(/\s+/g, ' ');
      const mine = got.roles ? (got.roles.attacker === 'A' ? 'attacker' : 'defender') : null;
      return {
        mine: mine,
        badge: /You attack|You defend/.test(t),
        said: mine ? new RegExp('As the ' + mine).test(t) : false,
        // the role it did NOT give you must not be described as yours
        other: mine ? new RegExp('As the ' + (mine === 'attacker' ? 'defender' : 'attacker')).test(t) : false
      };
    }, id);
    const want = id !== 'meeting';
    // the role is given with the job, on the contract screen, and only the one that is yours
    check(id + ': the role is settled, its badge shown with the job, and where it deploys',
      (!!seen.mine === want) && seen.badge === want && seen.said === want && !seen.other,
      want ? 'you are the ' + seen.mine : 'no roles to state');
  }
  await p.evaluate(() => window.__forceScenario('meeting'));
  await p.waitForTimeout(150);

  /* ----------------------------------------------------------- the battle */
  console.log('\nFighting');
  /* Drug Dealer: the units sent in Determined are said before the battle, and the
     battle waits for it to be read (it used to sit behind the battle and come up
     over the aftermath) */
  await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    if (c.companies.A.doctrines.indexOf('V4') < 0) c.companies.A.doctrines.push('V4');
    window.PMC_CAMPAIGN.set(c);
  });
  await p.waitForTimeout(200);
  const drug = await p.evaluate(() => { const b = document.querySelector('#camp-body [data-drug]:not([disabled])'); if (b) b.click(); return !!b; });
  await p.waitForTimeout(150);
  await clickText(p, 'Take the field');
  await p.waitForTimeout(600);
  const said = await p.evaluate(() => ({
    note: !document.getElementById('camp-ask').hidden && /Drug Dealer/.test(document.getElementById('camp-askbox').textContent),
    waiting: !document.getElementById('camp').hidden
  }));
  check('Drug Dealer: who goes in Determined is said before the battle', drug && said.note, JSON.stringify(said));
  check('...and the battle waits for it to be read', said.waiting);
  await p.evaluate(() => document.querySelector('#camp-askbox [data-ask="close"]').click());
  await p.waitForTimeout(1200);
  check('...then starts, the note gone with the campaign screen', await p.evaluate(() => document.getElementById('camp-ask').hidden));
  const inBattle = await p.evaluate(() => !!window.PMC_STATE() && document.getElementById('camp').hidden);
  check('the battle started with the campaign screen closed', inBattle);
  const built = await p.evaluate(() => window.PMC_STATE().units.filter(u => u.side === 'A')
    .map(u => ({ label: u.label, rid: u.rid || null })));
  check('every friendly unit carries its dossier id', built.every(u => u.rid),
    built.map(u => u.label).join(', '));

  // deploy, then let it run
  await p.evaluate(() => {
    const r = document.getElementById('resolution');
    if (r && !r.hidden) document.getElementById('res-continue').click();
  });
  await p.waitForTimeout(400);
  // Modifying the armies (p. 46) comes first: the company can swap from its dossier, and keeps its list here
  /* The offer is on the Actions panel before deploying (Modify your army, or
     Continue to deployment). So it waits for that. */
  await p.waitForFunction(() => document.querySelector('[data-act="swapopen"]') ||
    (window.PMC_STATE && !(window.PMC_STATE().swapAvail || {}).A), null, { timeout: 20000 }).catch(() => {});
  const swapNote = await p.evaluate(() => { const s = window.PMC_STATE(); return 'phase ' + s.phase + ', offer ' + JSON.stringify((s.swapAvail || {}).A || null); });
  check('the company may modify its army from the dossier once the table is laid', await p.evaluate(async () => {
    const b = document.querySelector('[data-act="swapopen"]'); if (!b) return false;
    b.click(); await new Promise(r => setTimeout(r, 200));
    const ok = document.querySelectorAll('[data-swappick]').length > 0;
    const d = document.querySelector('[data-act="swapdone"]'); if (d) d.click();
    return ok;
  }), swapNote);
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const b2 = (window.__sendIntent({ k: 'autosplit' }), ((document.querySelector('[data-act="deployready"]') && window.__sendIntent({ k: 'deployready' })), document.querySelector('button[data-act="autodeploy"]')));
    if (b2) b2.click();
  });
  await p.waitForTimeout(500);
  for (let i = 0; i < 8; i++) {
    await p.evaluate(() => {
      const r = document.getElementById('resolution');
      if (r && !r.hidden) document.getElementById('res-continue').click();
    });
    await p.waitForTimeout(200);
  }
  /* Rather than play twenty turns by hand, hand the battle to the AI on both
     sides — before Start, not after it. Handed over once the battle is under
     way, a company that wins the initiative is left waiting on a player who is
     no longer there: nothing asks the AI to act and the battle sits at turn 1
     for good (about half the time, whenever side A rolls the higher D10). */
  await p.evaluate(() => {
    const s = window.PMC_STATE();
    s.cfg.aiSides = ['A', 'B'];
    const b3 = window.__beginButton();
    if (b3) b3.click();
  });
  await p.waitForTimeout(600);
  console.log('  (both sides to the AI, and let it run)');
  let over = false;
  for (let i = 0; i < 3000; i++) {   // a slow twenty-turn battle needs the room
    over = await p.evaluate(() => {
      const s = window.PMC_STATE();
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
      return !!(s && s.over);
    });
    if (over) break;
    await p.waitForTimeout(110);
  }
  check('the battle reached a result', over);

  /* -------------------------------------------------------- the aftermath */
  console.log('\nThe aftermath');
  await p.waitForTimeout(1600);
  for (let i = 0; i < 8; i++) {
    const shown = await p.evaluate(() => !document.getElementById('camp').hidden);
    if (shown) break;
    await p.evaluate(() => {
      const r = document.getElementById('resolution');
      if (r && !r.hidden) { const c = document.getElementById('res-continue'); if (c) c.click(); }
    });
    await p.waitForTimeout(400);
  }
  // Tough Negotiators (the company's doctrine) is decided first, on its own screen
  txt = await body(p);
  check('the payment dice are offered for Tough Negotiators first', /After the battle/i.test(txt) && /Tough Negotiators/i.test(txt));
  await clickText(p, '^[Kk][Ee][Ee][Pp] [Tt][Hh][Ee][Mm] [Aa][Ll][Ll]$');
  await p.waitForTimeout(300);
  check('the other forces\u2019 battles were fought and reported on the aftermath', await pastFronts(p));
  txt = await body(p);
  check('the aftermath opened by itself', /Aftermath/.test(txt));
  check('...with a payment', /kUC/.test(txt), txt.match(/Two rolls of[^\n]*/)?.[0]);
  check('...and an experience ledger', /EXP/.test(txt),
    (txt.match(/\+\d+ EXP[^\n]*/g) || []).slice(0, 2).join(' | '));
  // a unit wiped out says so, and nothing more: no list of who fell in it
  const gone = await p.evaluate(() => [...document.querySelectorAll('#camp-body .dcard.gone')].map((c) => ({
    name: (c.querySelector('.dname') || {}).textContent,
    lines: [...c.querySelectorAll('.dledger')].map((l) => l.textContent.trim().slice(0, 60))
  })));
  check('a unit wiped out says it is struck off, with no list of who fell', gone.every((g) => g.lines.length >= 1 && !g.lines.some((l) => /Wounded|Killed|Casualties|out for the campaign/i.test(l))),
    gone.length ? JSON.stringify(gone) : '(no unit wiped out this time)');
  await shot(p, 'camp-aftermath.png');

  const afterState = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return {
      turn: c.turn, kUC: c.companies.A.kUC,
      roster: c.companies.A.roster.map(e => ({ name: e.name, exp: e.exp, tp: e.tp, rest: e.restUntil })),
      battles: c.companies.A.record.battles
    };
  });
  console.log('\n  the dossier after one battle — ' + afterState.kUC + ' kUC, campaign turn ' + afterState.turn + ':');
  afterState.roster.forEach(e => console.log('    ' + e.name.padEnd(26) +
    e.exp + ' EXP  ' + e.tp + ' TP' + (e.rest ? '  (in the workshop)' : '')));
  check('the campaign turn advanced', afterState.turn === 1);
  check('the company was paid', afterState.kUC > 0, afterState.kUC + ' kUC');
  check('units earned experience', afterState.roster.some(e => e.exp > 0));
  check('the battle was recorded', afterState.battles === 1);

  /* ---------------------------------------------------------- spending */
  const forces = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return (c.rivals || []).map(r => r.name + '/' + r.faction + '/T' + r.tier);
  });
  check('three forces are on the world', forces.length === 3, forces.join(', '));
  check('...with both kinds among them',
    forces.some(f => /pmc/.test(f)) && forces.some(f => /rebel/.test(f)));
  const nextUp = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    return c.companies.B === c.rivals[c.facing] ? c.companies.B.name : null;
  });
  check('the next opponent is drawn and aliased', !!nextUp, nextUp);

  console.log('\nSpending the pay');
  // the aftermath goes back to the campaign, on the company; the dossier is the tab beside it
  await click(p, '#camp-body .camp-dock [data-go="afterhub"]');
  check('the aftermath returns to the hub, on the company', await p.evaluate(() => !!document.querySelector('#camp-body .cpan-A .cstats') && !document.querySelector('#camp-body .cdos')));
  await click(p, '#camp-body .hubtabs [data-go="roster"]');
  await p.evaluate(() => document.querySelector('#camp-body [data-go="fmodal"][data-kind="recruit"]').click()); await p.waitForTimeout(220);
  check('Recruit opens in a window, closed by its ✕', await p.evaluate(() => { const m = document.querySelector('#camp-body .cmodal:not([hidden])'); return !!m && !!m.querySelector('[data-recruit]') && !!m.querySelector('[data-go="fmodalclose"]'); }));
  check('the free units carry the gift tag, the paid ones do not', await p.evaluate(() => {
    const row = (k) => document.querySelector('#camp-body .cmodal:not([hidden]) [data-recruit="' + k + '"]:not([data-asdrone]):not([data-asriders])');
    return !!row('penal') && !!row('penal').querySelector('.freemark') && !!row('recruits') && !row('recruits').querySelector('.freemark');
  }));
  if (process.env.SHOT) await p.screenshot({ path: 'build/ux/recruit-free.png' });
  const before = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  const recruited = await click(p, '#camp-body button[data-recruit="recruits"]');
  // it asks first, saying what it costs and what there is to spend
  const asked = await p.evaluate(() => { const b = document.getElementById('camp-askbox'); return !document.getElementById('camp-ask').hidden && b ? b.textContent : ''; });
  const unspent = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.kUC);
  check('recruiting asks first, with the cost and the funds', /costs 1 kUC/.test(asked) && new RegExp('have ' + unspent + ' kUC').test(asked) && unspent === afterState.kUC, asked);
  await p.evaluate(() => document.querySelector('#camp-askbox [data-ask="ok"]').click()); await p.waitForTimeout(220);
  check('a unit can be recruited from the dossier', recruited);
  const spent = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.kUC);
  check('...and it cost a kUC', spent === afterState.kUC - 1, spent + ' kUC left');
  // a vehicle above the company's Tier: asked with a reminder it fights only at Priority Level 2 until the company catches up
  const vehAsk = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get().companies.A;
    const b = [...document.querySelectorAll('#camp-body button[data-recruit]:not([data-asdrone])')].find(x => {
      const pr = window.PMC.profile(x.getAttribute('data-recruit')); return pr && pr.cls === 'vehicle' && pr.tier > c.tier && x.getAttribute('aria-disabled') !== 'true';
    });
    if (!b) return null;
    b.click();
    const t = document.getElementById('camp-askbox').textContent;
    document.querySelector('#camp-askbox [data-ask="close"]').click();
    return t;
  });
  check('a vehicle above the company\u2019s Tier is asked with the Priority Level 1 reminder', !!vehAsk && /Priority Level 1/.test(vehAsk) && /Priority Level 2/.test(vehAsk), vehAsk && vehAsk.slice(0, 200));
  await toUnits(p);
  const now = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  check('the new unit is on the books', now === before + 1, now + ' units');
  const second = await p.evaluate(() => { const r = window.PMC_CAMPAIGN.get().companies.A.roster; return r[r.length - 1].name; });
  check('...a second of a kind is the 2nd', second === '2nd Recruits', second);
  await shot(p, 'camp-roster.png');
  // a unit opened on the roster: its facts on the left, its picture drawn on the right, its sheet below
  await p.evaluate(() => { const c = document.querySelector('#camp-body .dcard.dclick'); if (c) c.click(); });
  await p.waitForTimeout(300);
  const unitOpen = await p.evaluate(() => {
    const card = document.querySelector('#camp-body .dcard.open'), cv = card && card.querySelector('canvas.dportrait');
    if (!cv) return { card: !!card };
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
    const det = card.querySelector('.ddet');
    // (its buttons ride the experience line across the top of the card, above the split)
    return { card: true, ink, left: !!card.querySelector('.dpic canvas.dportrait') && !!card.querySelector('.dopen .dvert'), below: !!det && !!(cv.compareDocumentPosition(det) & 4) };
  });
  check('an opened unit shows its picture under its facts', unitOpen.ink > 200 && unitOpen.left, JSON.stringify(unitOpen));
  check('...with its stats and special rules underneath', unitOpen.below, JSON.stringify(unitOpen));
  await shot(p, 'camp-unit.png');

  /* A promotion the force cannot pay for: greyed out, but it says by how much on
     its row, and a press says why rather than doing nothing */
  console.log('\nA promotion out of reach');
  const kucWas = await p.evaluate(() => {
    const camp = window.PMC_CAMPAIGN.get(), was = camp.companies.A.kUC;
    camp.companies.A.roster.forEach(e => { e.exp = 40; }); camp.companies.A.kUC = 0;
    window.PMC_CAMPAIGN.set(camp); return was;
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#camp-body button[data-promo]')].find(x => /Recruits|Enforcers|rifle/i.test(x.closest('.dcard').textContent)); if (b) b.click(); });
  await p.waitForTimeout(250);
  const broke = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body .cmodal:not([hidden]) button[data-promote]')].find(x => x.getAttribute('aria-disabled') === 'true');
    if (!b) return null;
    const row = b.textContent, before = window.PMC_CAMPAIGN.get().companies.A.roster.length;
    b.click();
    const tip = document.querySelector('.tip.on');
    return { row, disabled: b.disabled, tip: tip ? tip.textContent : '', same: window.PMC_CAMPAIGN.get().companies.A.roster.length === before && !!b.isConnected };
  });
  check('a promotion the force cannot afford says what it is short of, on its row', !!broke && /kUC short/.test(broke.row) && !broke.disabled, JSON.stringify(broke));
  check('...and pressed, says why and does nothing else', !!broke && /Short of/.test(broke.tip) && broke.same, broke && broke.tip);
  await p.evaluate(() => { window.PMCTips && window.PMCTips.hide(); const x = document.querySelector('#camp-body .cmodal:not([hidden]) [data-go="fmodalclose"]'); if (x) x.click(); });
  // one it can afford is asked first: cancelled, nothing changes; confirmed, the unit becomes the other kind
  const beforePromo = await p.evaluate(() => { const camp = window.PMC_CAMPAIGN.get(), was = JSON.stringify(camp); camp.companies.A.kUC = 20; window.PMC_CAMPAIGN.set(camp); return was; });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#camp-body button[data-promo]')].find(x => /Recruits|Enforcers|rifle/i.test(x.closest('.dcard').textContent)); if (b) b.click(); });
  await p.waitForTimeout(250);
  const promoAsk = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body .cmodal:not([hidden]) button[data-promote]')].find(x => x.getAttribute('aria-disabled') !== 'true');
    if (!b) return null;
    const rid = b.getAttribute('data-promote'), to = b.getAttribute('data-to'), keyOf = () => window.PMC_CAMPAIGN.get().companies.A.roster.find(e => String(e.rid) === rid).key;
    const was = keyOf();
    b.click();
    const box = document.getElementById('camp-askbox'), title = box && !box.hidden ? box.textContent : '';
    box.querySelector('[data-ask="close"]').click();
    const kept = keyOf() === was;
    const again = [...document.querySelectorAll('#camp-body .cmodal:not([hidden]) button[data-promote]')].find(x => x.getAttribute('data-promote') === rid && x.getAttribute('data-to') === to);
    if (again) { again.click(); document.querySelector('#camp-askbox [data-ask="ok"]').click(); }
    return { title, kept, now: keyOf() === to };
  });
  check('promoting a unit to another kind asks first, with what it costs', !!promoAsk && /Promote .+ to .+\?/.test(promoAsk.title) && /costs \d+ EXP/.test(promoAsk.title), promoAsk && promoAsk.title.slice(0, 160));
  check('...cancelled, nothing changes; confirmed, it is promoted', !!promoAsk && promoAsk.kept && promoAsk.now, JSON.stringify(promoAsk && { kept: promoAsk.kept, now: promoAsk.now }));
  await p.evaluate((was) => { window.PMC_CAMPAIGN.set(JSON.parse(was)); }, beforePromo);
  await p.evaluate((k) => { const camp = window.PMC_CAMPAIGN.get(); camp.companies.A.kUC = k; window.PMC_CAMPAIGN.set(camp); }, kucWas);
  await p.waitForTimeout(250);

  /* Battle Honours (p. 88): the player puts three forward, the dice pick one */
  console.log('\nA Battle Honour');
  await p.evaluate(() => {
    const camp = window.PMC_CAMPAIGN.get();
    camp.companies.A.roster.forEach(e => { e.exp = 40; });
    window.PMC_CAMPAIGN.set(camp);
  });
  await p.waitForTimeout(250);
  // a unit with the experience for it shows Promote; the honour is one of the choices behind it
  check('a unit with the experience shows Promote', await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button[data-promo]')].find(x => /Recruits|Enforcers|rifle/i.test(x.closest('.dcard').textContent));
    if (!b) return false;
    b.click(); return true;
  }));
  await p.waitForTimeout(250);
  // each promotion says what the unit becomes: its Tier and group
  const promo = await p.evaluate(() => [...document.querySelectorAll('#camp-body .cmodal:not([hidden]) button[data-promote]')].map(b => b.textContent));
  check('each promotion names the new unit\u2019s Tier and group', promo.length > 0 && promo.every(t => /Tier [IV]+ · \S/.test(t)), promo.join(' | '));
  // opened: the unit's buttons in a column down the right, its picture centred on the card and clear of them
  const rowAt = () => p.evaluate(() => {
    const card = document.querySelector('#camp-body .dcard.open'), top = card.querySelector('.dopen').getBoundingClientRect();
    const bs = [...card.querySelectorAll('.dopen .dvert button')].map(b => b.getBoundingClientRect());
    const col = card.querySelector('.dopen .dvert').getBoundingClientRect(), pic = card.querySelector('.dpic .dportrait').getBoundingClientRect();
    const bars = card.querySelector('.dopen .drow .dbars') && card.querySelector('.dopen .drow .dbars').getBoundingClientRect();
    return { n: bs.length, column: bs.every((b, i) => !i || b.top >= bs[i - 1].bottom - 1) && new Set(bs.map(b => Math.round(b.left))).size === 1,
      right: top.right - col.right < 4, picCentred: Math.abs((pic.left + pic.right) / 2 - (top.left + top.right) / 2) < 6,
      clear: pic.right <= col.left + 1, barsClear: !bars || bars.right <= col.left + 1 };
  });
  const deskRow = await rowAt();
  check('an opened unit\u2019s buttons run down the right, its picture centred on the card, clear of them', deskRow.n === 3 && deskRow.column && deskRow.right && deskRow.picCentred && deskRow.clear && deskRow.barsClear, JSON.stringify(deskRow));
  // closed, a card shows only Promote, and only with the experience for it, at the right of its line
  const shut = await p.evaluate(() => [...document.querySelectorAll('#camp-body .dcard:not(.open)')].map(c => {
    const bs = [...c.querySelectorAll('.dacts button')], row = c.querySelector('.drow'), r = row && row.getBoundingClientRect(), b = bs[0] && bs[0].getBoundingClientRect();
    return { n: bs.length, promo: bs.every(x => x.hasAttribute('data-promo')), right: !b || r.right - b.right < 4 };
  }));
  check('a closed card shows only Promote, at the right', shut.length > 0 && shut.every(x => x.n <= 1 && x.promo && x.right) && shut.some(x => x.n === 1), JSON.stringify(shut));
  // on a narrow phone too, the closed card's Promote stays on the EXP/TP line: the TP bar shrinks for it
  const vp0 = p.viewportSize();
  await p.setViewportSize({ width: 340, height: 780 });
  await p.waitForTimeout(200);
  const narrow = await p.evaluate(() => [...document.querySelectorAll('#camp-body .dcard:not(.open)')].filter(c => c.querySelector('.drow .dbars') && c.querySelector('.dacts button')).map(c => {
    const bars = c.querySelector('.drow .dbars').getBoundingClientRect(), b = c.querySelector('.dacts button').getBoundingClientRect();
    // (a vehicle has EXP but no TP bar)
    const tp = c.querySelector('.drow .dtp');
    return { one: b.top < bars.bottom && b.bottom > bars.top, tp: tp ? Math.round(tp.getBoundingClientRect().width) : null };
  }));
  check('...and on a narrow phone it stays on that line, the TP bar shrinking', narrow.length > 0 && narrow.every(x => x.one && (x.tp == null || x.tp > 10)), JSON.stringify(narrow));
  // ...and every closed card's TP bar is cut the same, whether it has Promote or not
  const widths = await p.evaluate(async () => {
    // one unit with no experience to spend, for the moment
    const camp = window.PMC_CAMPAIGN.get(), e = camp.companies.A.roster.find(x => window.PMC.profile(x.key).cls === 'infantry' && x.exp > 0 && !window.PMCCamp.isLeaderP(window.PMC.profile(x.key)));
    const was = e.exp; e.exp = 0; window.PMC_CAMPAIGN.set(camp);
    await new Promise(r => setTimeout(r, 200));
    document.querySelectorAll('#camp-body .cmodal').forEach(m => { m.hidden = true; });
    const ws = [...document.querySelectorAll('#camp-body .dcard:not(.open) .drow .dtp')].map(t => Math.round(t.getBoundingClientRect().width));
    const bare = document.querySelector('#camp-body .dcard[data-rid="' + e.rid + '"] .dacts button') === null;
    e.exp = was; window.PMC_CAMPAIGN.set(camp);
    return { widths: [...new Set(ws)], bare };
  });
  check('...every closed card\u2019s TP bar the same width, Promote or not', widths.bare && widths.widths.length === 1, JSON.stringify(widths));
  await p.setViewportSize(vp0);
  await p.waitForTimeout(200);
  const vp = p.viewportSize();
  await p.setViewportSize({ width: 412, height: 780 });
  await p.waitForTimeout(150);
  const phoneRow = await rowAt();
  check('...on a phone too', phoneRow.n === 3 && phoneRow.column && phoneRow.right && phoneRow.picCentred && phoneRow.clear && phoneRow.barsClear, JSON.stringify(phoneRow));
  // on a phone a unit's Rename, Disband and Promote are icons, on one row
  const row = await p.evaluate(() => {
    const acts = document.querySelector('#camp-body .dcard.open .dacts');
    const bs = acts ? [...acts.querySelectorAll('.dact')] : [];
    return { n: bs.length, tops: [...new Set(bs.map(x => Math.round(x.getBoundingClientRect().top)))].length,
      icons: bs.every(x => getComputedStyle(x.querySelector('svg')).display !== 'none' && getComputedStyle(x.querySelector('span')).display === 'none'),
      named: bs.every(x => x.getAttribute('aria-label')),
      soldiers: [...document.querySelectorAll('#camp-body [data-rsoldier]')].every(x => getComputedStyle(x.querySelector('svg')).display !== 'none' && getComputedStyle(x.querySelector('span')).display === 'none') };
  });
  check('on a phone a unit\u2019s Rename, Disband and Promote are icons, one above another', row.n === 3 && row.tops === 3 && row.icons && row.named && row.soldiers, JSON.stringify(row));
  await p.evaluate(() => { const m = document.querySelector('#camp-body .cmodal:not([hidden])'); if (m) m.hidden = true; });
  await shot(p, 'camp-dossier-phone.png');
  await p.evaluate(() => { const c = document.querySelector('#camp-body .dcard.open'); if (c) c.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelectorAll('#camp-body .cmodal').forEach(m => { m.hidden = true; }));
  await shot(p, 'camp-dossier-phone-closed.png');
  await p.evaluate(() => { const c = document.querySelector('#camp-body .dcard.dclick'); if (c) c.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const m = document.querySelector('#camp-body .cmodal[data-modal="promote"]'); if (m) m.hidden = false; });
  const opened = await p.evaluate(() => {
    const b = document.querySelector('#camp-body .cmodal:not([hidden]) button[data-honour]:not([aria-disabled="true"])');
    if (!b) return false;
    b.click(); return true;
  });
  check('the honour screen opens from the dossier', opened);
  const pool = await p.evaluate(() => ({
    all: document.querySelectorAll('#camp-body .doc').length,
    draw: (() => { const b = [...document.querySelectorAll('#camp-body button')]
      .find(x => /Choose three|Draw one/.test(x.textContent)); return b ? b.disabled : null; })()
  }));
  check('...offering every honour the unit has not earned', pool.all > 3, pool.all + ' on the table');
  check('...with the draw held back until three are chosen', pool.draw === true);
  // on a phone the list scrolls and the draw stays on the screen, at its foot
  const foot = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button')].find(x => /Choose three|Draw one/.test(x.textContent));
    const list = document.querySelector('#camp-body .docpick');
    return { bottom: b ? Math.round(b.getBoundingClientRect().bottom) : null, h: innerHeight,
      scrolls: list.scrollHeight > list.clientHeight + 2 && getComputedStyle(list).overflowY === 'auto',
      back: !document.getElementById('camp-back').hidden && document.getElementById('camp-back').getAttribute('data-go') === 'roster' };
  });
  check('...the draw button pinned to the foot of the screen, the list scrolling', foot.bottom != null && foot.bottom <= foot.h && foot.scrolls, JSON.stringify(foot));
  check('...and Back in the title bar', foot.back, JSON.stringify(foot));
  await shot(p, 'camp-honour-phone.png');
  await p.setViewportSize(vp);
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('#camp-body .doc')]
        .find(x => !/picked/.test(x.className) && !x.disabled);
      if (b) b.click();
    });
    await p.waitForTimeout(120);
  }
  const ready = await p.evaluate(() => ({
    picked: document.querySelectorAll('#camp-body .doc.picked').length,
    draw: (() => { const b = [...document.querySelectorAll('#camp-body button')]
      .find(x => /Draw one/.test(x.textContent)); return b ? b.disabled : null; })()
  }));
  check('the player chooses which three go in', ready.picked === 3, ready.picked + ' chosen');
  check('...and only then may they draw', ready.draw === false);
  const drew = await p.evaluate(() => {
    const before = window.PMC_CAMPAIGN.get().companies.A.roster
      .reduce((n, e) => n + (e.honours || []).length, 0);
    [...document.querySelectorAll('#camp-body button')].find(x => /Draw one/.test(x.textContent)).click();
    const el = document.querySelector('#camp-body .faults');
    return {
      gained: window.PMC_CAMPAIGN.get().companies.A.roster
        .reduce((n, e) => n + (e.honours || []).length, 0) - before,
      said: el ? el.textContent.trim() : '',
      shown: document.querySelectorAll('#camp-body .doc').length
    };
  });
  await p.waitForTimeout(200);
  check('one of the three is taken at random', drew.gained === 1, drew.said);
  check('...and only the three are left on the screen', drew.shown === 3, drew.shown + ' shown');
  await p.evaluate(() => document.getElementById('camp-back').click());   // the title bar's Back: to the dossier
  await p.waitForTimeout(200);
  await toUnits(p);
  await p.waitForTimeout(200);
  // the honour as a pill on the unit's closed card; opened, only written out in full on its sheet
  const pills = await p.evaluate(async () => {
    const rid = window.PMC_CAMPAIGN.get().companies.A.roster.find(e => (e.honours || []).length).rid;
    const card = () => document.querySelector('#camp-body .dcard[data-rid="' + rid + '"]');
    const o = document.querySelector('#camp-body .dcard.open'); if (o) { o.click(); await new Promise(r => setTimeout(r, 200)); }
    const closed = !!card().querySelector('.dmarks');
    card().click(); await new Promise(r => setTimeout(r, 250));
    const c = card();
    return { closed, open: !!c.querySelector('.dmarks'), sheet: !!c.querySelector('.ddet .ddet-rules li.good') };
  });
  check('an honour shows as a pill on a closed card, and only in full on the open one', pills.closed && !pills.open && pills.sheet, JSON.stringify(pills));

  /* ---------------------------------------------- asking, without native dialogs */
  console.log('\nAsking the player something');
  // the published page is sandboxed: confirm() answers false and prompt() answers
  // null without ever being shown, so every question has to be drawn in the page
  let nativeDialogs = 0;
  p.on('dialog', async d => { nativeDialogs++; await d.dismiss(); });

  // the dossier is already open in the hub's Tier panel
  if (!(await p.evaluate(() => !!document.querySelector('#camp-body .cdos')))) await clickText(p, '^Dossier$');
  await p.waitForTimeout(250);
  // (Rename is on an opened card)
  await p.evaluate(() => { if (!document.querySelector('#camp-body button[data-rename]')) { const c = document.querySelector('#camp-body .dcard.dclick'); if (c) c.click(); } });
  await p.waitForTimeout(250);
  const renamed = await p.evaluate(() => {
    const b = document.querySelector('#camp-body button[data-rename]');
    if (!b) return false;
    b.click(); return true;
  });
  await p.waitForTimeout(300);
  check('Rename asks in the page', renamed && await p.evaluate(() => !!document.getElementById('ask-input')));
  await p.evaluate(() => { document.getElementById('ask-input').value = "Kowalski's Lads"; });
  await p.evaluate(() => document.querySelector('[data-ask="ok"]').click());
  await p.waitForTimeout(350);
  check('...and the name sticks',
    await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.some(e => e.name === "Kowalski's Lads")));

  // Abandon sits in the Tier panel: close the dossier to bring it back
  await p.evaluate(() => { const b = document.querySelector('#camp-body .hubtabs [data-go="roster"]:first-child'); if (b) b.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector('#camp-body [data-go="wipe"]').click());
  await p.waitForTimeout(300);
  check('Abandon asks in the page',
    await p.evaluate(() => !document.getElementById('camp-ask').hidden));
  await p.evaluate(() => document.querySelector('[data-ask="close"]').click());
  await p.waitForTimeout(300);
  check('...Cancel leaves the campaign alone',
    await p.evaluate(() => !!window.PMC_CAMPAIGN.get()));
  check('no native dialog was ever raised', nativeDialogs === 0, nativeDialogs + ' raised');

  /* ------------------------------------------------------- reload and go on */
  console.log('\nReloading the page');
  await p.reload();
  await p.waitForTimeout(900);
  await p.evaluate(() => window.PMC_CAMPAIGN.enter()); await p.waitForTimeout(300);
  txt = await body(p);
  check('the campaign came back after a reload', /Task Force Ironhold/.test(txt));
  check('...at the same campaign turn', await p.evaluate(() => window.PMC_CAMPAIGN.get().turn === 1));
  const back = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.kUC);
  check('...with the money intact', back === spent, back + ' kUC');
  const rosterBack = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  check('...and the recruit still on the books', rosterBack === now, rosterBack + ' units');

  console.log('\nproblems: ' + (problems.length ? problems.join('; ') : 'none'));
  console.log('page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log('screens: ' + shots.join(', '));
  await b.close();
  process.exit(problems.length || errs.length ? 1 : 0);
})();
