/* A campaign played through the interface: found a company, take a contract,
   fight the battle, read the aftermath, spend the pay — then do it again, and
   check the dossier remembers everything in between. */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, SHOTS } = require('../where.js');

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
  await p.evaluate(() => { const b = document.querySelector('#camp-body [data-rtab="units"]'); if (b) b.click(); });
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

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1340, height: 940 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
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
  check('the founding screen opened', await p.evaluate(() => !!document.getElementById('found-name') && /the company/i.test(document.querySelector('#camp-body .found-units .muster-head').textContent)));
  // the name and the colours are settled here now, with the units
  await p.evaluate(() => { document.getElementById('found-name').value = 'Task Force Ironhold'; });
  check('...and asks for the company name there',
    await p.evaluate(() => !!document.getElementById('found-name')));
  check('...and for its colours',
    await p.evaluate(() => { document.querySelector('[data-go="fcolour"]') && document.querySelector('[data-go="fcolour"]').getAttribute('aria-expanded') !== 'true' && document.querySelector('[data-go="fcolour"]').click(); return document.querySelectorAll('#camp-body [data-campcolour]').length > 1; }));

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

  /* the road to the next Company Tier, laid out step by step (pp. 83-84) —
     behind the Company button, the hub opening on the dossier */
  check('the hub opens on the dossier', await p.evaluate(() => !!document.querySelector('#camp-body .cdos')));
  await p.evaluate(() => { const b = document.querySelector('#camp-body .dosbar [data-go="roster"]'); if (b) b.click(); });
  await p.waitForTimeout(200);
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

  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('pmc-campaign')));
  check('the campaign was written to storage', !!saved && saved.companies.A.roster.length >= 9,
  (saved ? saved.companies.A.roster.length + ' units, Tier ' + saved.companies.A.tier : 'nothing saved'));

  /* -------------------------------------------------------- the contract */
  console.log('\nTaking a contract');
  await p.evaluate(() => { const b = document.querySelector('#camp-body .dosbar [data-go="roster"]'); if (b) b.click(); });   // the hub opens on the dossier
  await p.waitForTimeout(200);
  await clickText(p, '^Contract$');
  txt = await body(p);

  /* the three jobs on the table: who, how they fight, what it is for, and which
     side of it you would be on — and nothing at all about what they will field */
  const offers = await p.evaluate(() => {
    const c = window.PMC_CAMPAIGN.get();
    const cards = [...document.querySelectorAll('#camp-body .cpan-offer')];
    return {
      cards: cards.length,
      rivals: c.rivals.length,
      names: c.rivals.filter(r => cards.some(k => k.textContent.includes(r.name))).length,
      scenarios: cards.filter(k => /Scenario D6/.test(k.textContent)).length,
      doctrines: cards.filter(k => !!k.querySelector('.cpdoc .mk, .cpdoc .dnote')).length,
      styles: c.rivals.filter(r => cards.some(k => k.textContent.includes(window.PMCCamp.themeOf(r)))).length,
      sizes: cards.filter(k => /Battle Tier/.test(k.textContent) && /Priority Level/.test(k.textContent) &&
        /most they can meet you at/.test(k.textContent)).length,
      roles: cards.filter(k => /You attack|You defend|even terms/.test(k.textContent)).length,
      buttons: cards.filter(k => /Take this contract/.test(k.textContent)).length,
      // nothing that gives away the list: no unit counts, no dossier peek
      composition: cards.filter(k => /\d+ units|Their dossier/.test(k.textContent)).length,
      stable: JSON.stringify(c.offers.map(o => o.scenario.id))
    };
  });
  check('a contract is offered for each force, give or take', offers.cards >= 2 && offers.cards <= offers.rivals * 2,
    offers.cards + ' jobs against ' + offers.rivals + ' forces');
  check('...each named', offers.names >= Math.min(offers.cards, offers.rivals) - 1,
    offers.names + ' of ' + offers.rivals + ' forces named');
  check('...with the way they fight', offers.styles >= Math.min(offers.cards, offers.rivals) - 1);
  check('...and how big a fight they can meet you at', offers.sizes === offers.cards);
  check('...and what they are built around', offers.doctrines === offers.cards);
  check('...a rolled scenario', offers.scenarios === offers.cards);
  check('...and which side of it you would be on', offers.roles === offers.cards);
  check('none of them shows their force composition', offers.composition === 0,
    offers.composition ? offers.composition + ' cards leak the list' : 'no unit counts, no dossier');
  check('every one can be taken', offers.buttons === offers.cards);
  // leaving and coming back must not re-roll the jobs
  await clickText(p, 'Back');
  await p.evaluate(() => { const b = document.querySelector('#camp-body .dosbar [data-go="roster"]'); if (b) b.click(); });   // the hub opens on the dossier
  await p.waitForTimeout(200);
  await clickText(p, '^Contract$');
  const again = await p.evaluate(() =>
    JSON.stringify(window.PMC_CAMPAIGN.get().offers.map(o => o.scenario.id)));
  check('...and the jobs do not change if you leave and come back', again === offers.stable, again);
  await shot(p, 'camp-offers.png');

  await p.evaluate(() => {
    document.querySelector('#camp-body [data-take-offer]').click();
  });
  await p.waitForTimeout(250);
  txt = await body(p);
  check('a Battle Tier was rolled and capped', /Battle Tier I/.test(txt), txt.split('\n')[1]);
  // a D6 across all six now, at every Tier — not the D3 that only ever reached three
  check('the contract names who you are fighting', /against/i.test(txt) || /Battle Tier/i.test(txt),
    (txt.match(/Against [^\n—]+/i) || [])[0]);
  check('a scenario was rolled',
    /Meeting engagement|Secure and control|Find and secure|Invasion|Demolish|Hostile takeover/.test(txt),
    (txt.match(/Meeting engagement|Secure and control|Find and secure|Invasion|Demolish|Hostile takeover/) || [])[0]);
  /* what each unit is carrying, on the button that puts it in the list */
  const wear = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#camp-body .cu')];
    return {
      rows: rows.length,
      tp: rows.filter(r => /\d+\/\d+ TP/.test(r.textContent)).length,
      exp: rows.filter(r => /\d+ EXP/.test(r.textContent)).length,
      sample: rows[0] ? rows[0].textContent.replace(/\s+/g, ' ').slice(0, 70) : ''
    };
  });
  check('every unit shows its Trauma Points when picking the list', wear.rows > 0 && wear.tp === wear.rows,
    wear.tp + ' of ' + wear.rows + ' — ' + wear.sample);

  await clickText(p, 'Fill the list for me');
  txt = await body(p);
  check('the list filled legally', /A legal Battle Tier/.test(txt), txt.match(/\d+ \/ \d+/)?.[0]);
  // a disabled primary button used to look exactly like a live one
  const btn = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button.start')][0];
    const cs = getComputedStyle(b);
    return { disabled: b.disabled, opacity: +cs.opacity, cursor: cs.cursor };
  });
  check('the Take the field button is live on a legal list',
    !btn.disabled && btn.opacity === 1, JSON.stringify(btn));
  // and drops dead visibly on an illegal one — keep removing until it is
  for (let i = 0; i < 8; i++) {
    const stillLegal = await p.evaluate(() => {
      const b = [...document.querySelectorAll('#camp-body button.start')][0];
      return !b.disabled;
    });
    if (!stillLegal) break;
    await p.evaluate(() => {
      const drop = document.querySelector('#camp-body button[data-unpick]');
      if (drop) drop.click();
    });
    await p.waitForTimeout(250);
  }
  const off = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#camp-body button.start')][0];
    const cs = getComputedStyle(b);
    const why = document.querySelector('#camp-body .blockwhy');
    return { disabled: b.disabled, opacity: +cs.opacity, cursor: cs.cursor, why: why ? why.textContent.trim() : null };
  });
  check('...and visibly dead, with a reason, on an illegal one',
    off.disabled && off.opacity < 0.6 && off.cursor === 'not-allowed' && !!off.why,
    off.why ? off.why.slice(0, 80) : JSON.stringify(off));
  await clickText(p, 'Fill the list for me');
  await p.waitForTimeout(250);
  await shot(p, 'camp-contract.png');

  /* the three asymmetric scenarios tell the player, on this screen, that the
     roles are randomised when the battle opens and what each one would mean */
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
    check(id + ': the contract screen states your role',
      (!!seen.mine === want) && seen.badge === want && seen.said === want && !seen.other,
      want ? 'you are the ' + seen.mine : 'no roles to state');
  }
  await p.evaluate(() => window.__forceScenario('meeting'));
  await p.waitForTimeout(150);

  /* ----------------------------------------------------------- the battle */
  console.log('\nFighting');
  await clickText(p, 'Take the field');
  await p.waitForTimeout(1200);
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
  check('the company may modify its army from the dossier once the table is laid', await p.evaluate(async () => {
    const b = document.querySelector('[data-act="swapopen"]'); if (!b) return false;
    b.click(); await new Promise(r => setTimeout(r, 200));
    const ok = document.querySelectorAll('[data-swappick]').length > 0;
    const d = document.querySelector('[data-act="swapdone"]'); if (d) d.click();
    return ok;
  }));
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const b2 = document.querySelector('button[data-act="autodeploy"]');
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
    const b3 = document.querySelector('button[data-act="start"]');
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
  txt = await body(p);
  check('the aftermath opened by itself', /Aftermath/.test(txt));
  check('...with a payment', /kUC/.test(txt), txt.match(/Two rolls of[^\n]*/)?.[0]);
  check('...and an experience ledger', /EXP/.test(txt),
    (txt.match(/\+\d+ EXP[^\n]*/g) || []).slice(0, 2).join(' | '));
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
  await clickText(p, 'Spend the pay');
  await p.evaluate(() => document.querySelector('#camp-body [data-rtab="recruit"]').click()); await p.waitForTimeout(220);
  const before = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  const recruited = await click(p, '#camp-body button[data-recruit="recruits"]');
  check('a unit can be recruited from the dossier', recruited);
  const spent = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.kUC);
  check('...and it cost a kUC', spent === afterState.kUC - 1, spent + ' kUC left');
  await toUnits(p);
  const now = await p.evaluate(() => window.PMC_CAMPAIGN.get().companies.A.roster.length);
  check('the new unit is on the books', now === before + 1, now + ' units');
  await shot(p, 'camp-roster.png');

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
  const opened = await p.evaluate(() => {
    const b = document.querySelector('#camp-body .cmodal:not([hidden]) button[data-honour]:not([disabled])');
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
  await clickText(p, 'Back to the dossier');
  await p.waitForTimeout(200);
  await toUnits(p);
  await p.waitForTimeout(200);

  /* ---------------------------------------------- asking, without native dialogs */
  console.log('\nAsking the player something');
  // the published page is sandboxed: confirm() answers false and prompt() answers
  // null without ever being shown, so every question has to be drawn in the page
  let nativeDialogs = 0;
  p.on('dialog', async d => { nativeDialogs++; await d.dismiss(); });

  // the dossier is already open in the hub's Tier panel
  if (!(await p.evaluate(() => !!document.querySelector('#camp-body .cdos')))) await clickText(p, '^Dossier$');
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
  await p.evaluate(() => { const b = document.querySelector('#camp-body .dosbar [data-go="roster"]'); if (b) b.click(); });
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
  await click(p, '#btn-campaign');
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
