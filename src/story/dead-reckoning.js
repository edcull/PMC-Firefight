/* PMC 2670 — Firefight : Dead Reckoning, the second story (docs/story-dead-reckoning-plan.md)

   The story bible as data (phase 0): every chapter, event, battle, thread
   and ending in the plan, each event's situation and options in a line, and
   the meters and flags each one moves. The words are placeholders; the
   prose, maps and voices come in their own files, as Deep Contract's do.

   A treasure hunt: a dead surveyor's log, the lodestones he left, and a lost
   Xenotripod world at the end of them, raced for by rival PMCs, each one of
   the game's archetypes. The lodestones are two meters (`stones`, the
   company's; `theirs`, the rivals'), each rival's strength is a meter named
   for it, and each company that can be hired has a price and a trust, as
   meters too. Forces name their archetype (`archetype`), the Hashamer their
   skin and what they go without; the battle hooks read those from phase 1. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');
  // the story's words, maps and voices, kept in files of their own (dead-reckoning-text.js, -maps.js, -talk.js)
  if (!(root.PMCStoryText && root.PMCStoryText['dead-reckoning']) && typeof require === 'function') require('./dead-reckoning-text.js');
  if (!(root.PMCStoryMaps && root.PMCStoryMaps['dead-reckoning']) && typeof require === 'function') require('./dead-reckoning-maps.js');
  if (!(root.PMCStoryTalk && root.PMCStoryTalk['dead-reckoning']) && typeof require === 'function') require('./dead-reckoning-talk.js');
  var TEXT = (root.PMCStoryText && root.PMCStoryText['dead-reckoning']) || {};

  /* The words laid over the working, where the words file has them: a
     chapter's intro, a node's text and mission name, an option's text and
     why it is closed. */
  function withProse(def) {
    (def.chapters || []).forEach(function (ch) {
      if (TEXT[ch.id]) ch.intro = TEXT[ch.id];
      // how the job is put to the company when it is offered at the pool: the story, not the thread
      if (TEXT[ch.id + '.pitch']) ch.pitch = TEXT[ch.id + '.pitch'];
      (ch.nodes || []).forEach(function (n) {
        if (TEXT[n.id]) n.text = TEXT[n.id];
        if (TEXT[n.id + '#name']) n.name = TEXT[n.id + '#name'];
        (n.options || []).forEach(function (o) {
          if (TEXT[n.id + '/' + o.id]) o.text = TEXT[n.id + '/' + o.id];
          if (TEXT[n.id + '/' + o.id + '.why']) o.why = TEXT[n.id + '/' + o.id + '.why'];
        });
      });
    });
    return def;
  }
  /* Where each chapter happens: the scene on its card (view/story-scenes.js),
     and a battle's own where its chapter's will not do (a compound inside it). */
  var SCENE = { c1: 'vesk', c2: 'glassflats', c3: 'mire', c4: 'docks', warren: 'warren', doublecross: 'dockring',
    // the second half: a chapter's card shows its own ground, and a compound's briefing its chapter's
    claim: 'hollin', wreck: 'wreck', bounty: 'ilya', landing: 'quietfield', watchers: 'brannock', storm: 'sedra', cold: 'coldsites', spire: 'spire',
    mimics: 'hashamer', speaker: 'orlo', signal: 'beaconlit', vault: 'vault', escort: 'umber', debts: 'tarn', collector: 'quietfield', recall: 'quietfog' };
  var BATTLE_SCENE = { 'c2t.battle': 'thule', 'warren.battle': 'warren' };
  function withScenes(def) {
    (def.chapters || []).forEach(function (ch) {
      if (SCENE[ch.id]) ch.scene = { place: SCENE[ch.id] };
      (ch.nodes || []).forEach(function (n) { if (BATTLE_SCENE[n.id]) n.scene = BATTLE_SCENE[n.id]; });
    });
    return def;
  }
  /* What is said in its battles and on its pages (dead-reckoning-talk.js),
     and the voices that say it among its people. */
  function withTalk(def) {
    var talk = root.PMCStoryTalk && root.PMCStoryTalk['dead-reckoning'];
    if (!talk) return def;
    def.talk = { sides: talk.sides || {}, battles: talk.battles || {}, allies: talk.allies || {}, parleys: talk.parleys || {} };
    Object.keys(talk.people || {}).forEach(function (k) { if (!def.people[k]) def.people[k] = talk.people[k]; });
    // (a conversation keyed `node/option` is what is said straight after that choice)
    Object.keys(talk.conversations || {}).forEach(function (key) {
      var id = key.split('/')[0], opt = key.split('/')[1];
      (def.chapters || []).forEach(function (ch) { (ch.nodes || []).forEach(function (n) {
        if (n.id !== id) return;
        if (!opt) n.talk = talk.conversations[key];
        else (n.options || []).forEach(function (o) { if (o.id === opt) o.said = talk.conversations[key]; });
      }); });
    });
    return def;
  }

  /* ---------- the forces ---------- */
  function over(base, extra) {
    var out = Object.assign({}, base, extra || {});
    if (extra && extra.changes) out.changes = (base.changes || []).concat(extra.changes);
    return out;
  }
  /* A rival PMC: its archetype's own kind of force, scaled by its strength.
     (The units here are the archetype's; phase 1 draws the optional units and
     the filler from the archetype's weights.) */
  var RIVAL = {
    kettle: { archetype: 'swarm', core: [{ key: 'lmgsection', name: 'Kettering’s Own' }], units: ['recruits', 'irregulars', 'rookie', 'mortarsection', 'unarmoured'], fill: ['recruits', 'irregulars', 'rookie'] },
    wraith: { archetype: 'marksmen', core: [{ key: 'observers', name: 'Nine’s Section' }], units: ['observers', 'nomads', 'lpv', 'recon', 'ew'], fill: ['irregulars', 'observers', 'nomads'] },
    sable: { archetype: 'armour', core: [{ key: 'ecobats', name: 'Sable’s Guard' }], units: ['ecobats', 'bats', 'lhunter', 'protectors', 'hunter'], fill: ['enforcers', 'ecobats', 'recruits'] },
    kestrel: { archetype: 'aircav', core: [{ key: 'lighteng', name: 'Kestrel Lead' }], units: ['lapc', 'recruits', 'lifv', 'rookie', 'lpv'], fill: ['recruits', 'irregulars', 'rookie'] },
    reavers: { archetype: 'shock', core: [{ key: 'enforcers', name: 'Big Hal’s Boarders' }], units: ['irregulars', 'lighteng', 'chem', 'lpv', 'commandos'], fill: ['irregulars', 'enforcers'] },
    lance: { archetype: 'elite', core: [{ key: 'veterans', name: 'Commander Daw' }], units: ['rookie', 'veterans', 'snipers', 'rangers', 'medics'], fill: ['recruits', 'rookie', 'enforcers'] }
  };
  /* `extra.drop`: the flags that cannot have happened yet where it is fought
     (a first meeting has no grudge, and nobody has been filmed in the first
     half): their changes are left off, as the story's checker asks. */
  function rival(id, extra) {
    var r = RIVAL[id], drop = (extra && extra.drop) || [];
    if (extra && extra.drop) { extra = Object.assign({}, extra); delete extra.drop; }
    var keep = function (c) { return !(c.if && c.if.flag && drop.indexOf(c.if.flag) >= 0); };
    return over({
      side: id, faction: 'pmc', archetype: r.archetype,
      core: r.core.slice(),
      optional: { meter: id === 'lance' ? 'lance' : id, per: 2, units: r.units },
      // the filler: the archetype's own kind of force (levers.js), the units written here if it can't be rolled
      fill: { to: 0.85, archetype: true, from: r.fill, meter: id === 'lance' ? 'lance' : id, step: 0.05 },
      changes: [
        { if: { flag: 'kestrel_filmed' }, readiness: 1 },          // they have seen how the company fights
        { if: { meter: 'lead', lte: -3 }, readiness: 1 },          // dug in before the company got there
        { if: { flag: 'beat_' + id }, readiness: 1 }               // beaten once, and waiting for the company since (a grudge)
      ].concat(id === 'kettle' ? [{ if: { flag: 'agent_jailed' }, readiness: 1 }] : []).filter(keep)   // their man handed to the port: they come for the company
    }, extra);
  }
  // a Xenotripod tribe: its archetype's force, scaled by Alarm
  var TRIBE = {
    shkar: { core: ['xdelta1', 'xbeta2', 'xtturret2'], units: ['xdelta1', 'xbeta2', 'xstrike2', 'xdelta2'], fill: ['xdelta1', 'xeps1'] },
    mithdu: { core: ['xeps1', 'xeps1', 'xdturret1'], units: ['xeps2', 'xbeta2', 'xtturret2', 'xdelta1'], fill: ['xeps1', 'xdelta1'] },
    hashamer: { core: ['xeps1', 'xeps1', 'xdelta1'], units: ['xeps2', 'xdelta2', 'xdturret1'], fill: ['xeps1', 'xdelta1'] },
    ulvar: { core: ['xdelta1', 'xsturret3', 'xdturret1'], units: ['xbeta2', 'xgamma3', 'xdturret2', 'xshieldb'], fill: ['xdelta1', 'xbeta2'] },
    amt: { core: ['xbeta2', 'xgamma3', 'xstrike2'], units: ['xgamma3', 'xbeta3', 'xrecon', 'xshieldb'], fill: ['xbeta2', 'xgamma3'] }
  };
  function tribe(id, extra) {
    var t = TRIBE[id];
    return over({
      side: id, faction: 'xeno', archetype: id,
      core: t.core.slice(),
      optional: { meter: 'alarm', per: 2, units: t.units },
      fill: { to: 0.85, archetype: true, from: t.fill, meter: 'alarm', step: 0.05 }
    }, extra);
  }
  // the Hashamer: Xenotripod units, every one an Esh-Aven, with no craft and no teleport turrets
  var HASHAMER = { skin: 'eshaven', without: ['Strike Aviation', 'Support Aviation', 'Teleport Turrets'] };
  function hashamer(extra) { return tribe('hashamer', Object.assign({}, HASHAMER, extra || {})); }
  var ESHAVEN_ALLIES = Object.assign({ side: 'hashamer', faction: 'xeno', archetype: 'hashamer', core: ['xeps1', 'xdelta1'] }, HASHAMER);

  /* ---------- the hired guns: allies at a price ---------- */
  var HIRE = {
    kettle: { side: 'kettle', faction: 'pmc', archetype: 'swarm', core: ['recruits', 'irregulars'] },
    kestrel: { side: 'kestrel', faction: 'pmc', archetype: 'aircav', core: ['lapc', 'recruits'] },
    reavers: { side: 'reavers', faction: 'pmc', archetype: 'shock', core: ['enforcers', 'irregulars'] },
    sable: { side: 'sable', faction: 'pmc', archetype: 'armour', core: ['ecobats', 'enforcers'] }
  };
  /* What opens each company's door. None of them works for a company it has
     stopped trusting (Trust −3 or lower), and the two that sell out don't come
     back once they have. */
  var HIRE_IF = {
    kettle: { all: [{ flag: 'kettle_contact' }, { not: { flag: 'kettle_burned' } }, { not: { flag: 'kettle_turned' } }, { meter: 'kettle_trust', gte: -2 }] },
    kestrel: { all: [{ flag: 'kestrel_deal' }, { meter: 'kestrel_trust', gte: -2 }] },
    reavers: { all: [{ flag: 'reavers_spared' }, { not: { flag: 'reavers_turned' } }, { meter: 'reavers_trust', gte: -2 }] },
    sable: { all: [{ flag: 'sable_owed' }, { meter: 'sable_trust', gte: -2 }] }
  };
  var HIRE_WHY = {
    kettle: 'Brass Ledger don’t deal with you.', kestrel: 'Kestrel isn’t interested in you yet.',
    reavers: 'The Reavers have no reason to fight for you.', sable: 'Sable owes you nothing.'
  };
  function hireOption(id, text) {
    return {
      id: 'hire_' + id, hire: id, text: text, if: HIRE_IF[id], why: HIRE_WHY[id], cost: { kUC: id + '_price' },
      battle: { allies: HIRE[id] },
      effects: [{ flag: id + '_hired' }, { meter: id + '_price', add: 1 }]
        // (worked for the company once: the two that sell out can be bought away from it after)
        .concat(id === 'kettle' || id === 'reavers' ? [{ flag: id + '_worked' }] : [])
        // (and the company doesn't like fighting beside the Reavers: it wears on them)
        .concat(id === 'reavers' ? [{ meter: 'fatigue', add: 1 }] : [])
    };
  }
  // the hired guns' own events after a battle they fought in
  var HIRED_EVENTS = ['hired.invoice', 'hired.edit', 'hired.mess', 'hired.favour', 'hired.kettleoffer', 'hired.reaversoffer'];

  /* ---------- interludes: one event each, the first that applies ---------- */
  var INTERLUDE = ['i.wake', 'i.tired', 'i.sendahead', 'i.voices', 'i.warm', 'i.newsfeed', 'i.catalogue', 'i.jump'];
  function interlude(id, next, text) {
    return { id: id, type: 'interlude', text: text || 'The company jumps on, and refits on the way.', events: INTERLUDE, next: next };
  }

  /* ---------- a second-half chapter: brief, event, battle, debrief, interlude ---------- */
  function poolChapter(o) {
    var id = o.id, nodes = [{ id: id + '.brief', type: 'brief', text: o.brief, next: o.before ? o.before.id : id + '.battle' }];
    if (o.before) nodes.push(Object.assign({ type: 'event', next: id + '.battle' }, o.before));
    nodes.push(Object.assign({ id: id + '.battle', type: 'battle', tier: 'max', pl: 1, next: id + '.debrief' }, o.battle));
    nodes.push({ id: id + '.debrief', type: 'debrief', pick: 3, text: o.debrief || 'The fighting is over.',
      events: (o.after ? [o.after.id] : []).concat(o.finale ? [] : HIRED_EVENTS), next: o.finale ? 'end' : id + '.interlude' });
    if (o.after) nodes.push(Object.assign({ type: 'event' }, o.after));
    if (!o.finale) nodes.push(interlude(id + '.interlude', 'pool'));
    return { id: id, half: 2, thread: o.thread, title: o.title, when: o.when, fallback: !!o.fallback, finale: !!o.finale,
      passed: o.passed, onStart: o.onStart, place: o.place, rival: o.rival, nodes: nodes };
  }
  // a side contract's cost in time: in the second half the rivals gain while you are away
  /* The first half's unknown contacts (storybattle.js contacts): what steps out
     of the air at the beacon, and what comes out of the walls past its gate.
     Xenotripods, though nobody in the first half has the word: a unit a key,
     two more than the battle's Tier. */
  var CONTACTS = ['xalpha1', 'xeps1', 'xbeta2', 'xeps1'];
  var CONTACTS_DEEP = ['xeps1', 'xeps1', 'xalpha1', 'xbeta2'];
  /* Lot 47 lost and the log let go (c1.lost): it is not to be had for money.
     Brass Ledger's broker shows it at Kerrigan beside the heading, and only the
     warehouse taken by force brings it back (or the sale at the beacon broken
     up). */
  var LOG_BACK = [{ if: { flag: 'ledger_has_log' }, meter: 'theirs', add: -1 }, { if: { flag: 'ledger_has_log' }, flag: 'ledger_has_log', set: false }];
  /* ...or the log rebuilt without them, from what the company has found on the
     way: Wraith Section's stolen copy, or Morrow's own records at Thule, put
     together with the first pages Halloran photographed in the arcade. */
  function rebuilt(from) {
    return [{ if: { flag: 'ledger_has_log' }, journal: 'Halloran rebuilds the log from ' + from + ' and his eleven photographed pages.' },
      { if: { flag: 'ledger_has_log' }, meter: 'lead', add: 1 }, { if: { flag: 'ledger_has_log' }, flag: 'ledger_has_log', set: false }];
  }
  var LATE_TIME = { if: { chapter: { gte: 5 } }, meter: 'lead', add: -1 };
  // (each finale lost says how: the claim jumped, the Quiet woken, Vane repossessing)
  var FINALE_ON = {
    success: [{ effects: [{ flag: 'finale_won' }] }]
  };
  // the Quiet, where every finale is fought
  var QUIET = { system: 'the end of the log', planet: 'the Quiet', kind: 'dense', world: { gravity: 'low', atmosphere: 'foggy', anomaly: 'none' } };
  // Varga's rule from Deep Contract: Varga speaks only when free; here, the Esh-Aven only fight beside you while the promise holds
  var ESHAVEN_WITH_YOU = { all: [{ flag: 'eshaven_freed' }, { not: { flag: 'promise_broken' } }] };
  // the promise broken by an act, where it was made
  function breaks() { return { if: { flag: 'eshaven_promise' }, flag: 'promise_broken' }; }

  S.register(withScenes(withTalk(withProse({
    id: 'dead-reckoning', name: 'Dead Reckoning', version: 1, length: 8,
    // a star chart between chapters and in the journal (story.js chart, view/story-chart.js)
    chart: true,
    // the two halves, as the chapter cards name them, and those who were there from the start
    halves: ['The Chart', 'The Long Jump'], firstDay: 'on the trail from Vesk',
    blurb: 'A dead surveyor’s log, and the strange stones he left behind, lead across the stars to a world nobody has charted. Halloran, an archaeologist of archives who reads Morrow’s writing better than anyone alive, hires your company to follow them, with money from a backer he will not name. Every other company on the trail was hired to get there first, and none of them has met its client either. Nobody has asked who made the stones.',
    start: { faction: 'pmc', found: 'standard' },

    // what the company knows of the enemy before a battle (story.js `intel`)
    intel: [
      { if: { meter: 'intel', gte: 3 }, add: 1 },
      { if: { meter: 'intel', gte: 6 }, add: 1 },
      { if: { flag: 'wraith_turned' }, add: 1 },
      { if: { flag: 'morrow_found' }, add: 1 },
      { if: { meter: 'understanding', gte: 4 }, add: 1, side: 'shkar' }
    ],
    flagText: {
      kettle_contact: 'Brass Ledger will deal with you.', kettle_burned: 'Brass Ledger won’t forget what you did to their man.',
      wraith_robbed: 'Wraith Section wants its copy of the log back.', thule_records: 'You heard Morrow’s own voice.',
      beacon_rubbing: 'The beacon answered your signal.', relics_returned: 'You gave back what was taken from the beacon.',
      warren_entered: 'You stepped through the gate at the beacon.', chart_sold: 'You sold a copy of the chart.',
      vane_suspects: 'Halloran’s backer suspects you.', vane_cut_off: 'Halloran’s backer has cut you off.', eshaven_freed: 'The Hashamer guide you.',
      eshaven_promise: 'You promised the Hashamer the Quiet would stay asleep.', promise_broken: 'You broke your promise to the Hashamer.',
      contact: 'You have spoken with the Amt.', morrow_found: 'You found Morrow.',
      log_lost: 'Brass Ledger have the log.', ledger_has_log: 'Brass Ledger have the log, and are selling what it says.',
      beat_kettle: 'Brass Ledger hasn’t forgotten Vesk.', beat_wraith: 'Wraith Section hasn’t forgotten the Glass Flats.', beat_sable: 'Colonel Sable hasn’t forgotten her warehouse.', beat_reavers: 'The Red Reavers haven’t forgotten the beacon.', beat_kestrel: 'Kestrel Air Cavalry has a score to settle.', beat_lance: 'The Ninth Lance has a score to settle.'
    },

    /* Vane's bonus for a story battle won, by his Trust; none once he has cut you off. */
    pay: { base: 2, meter: 'vane', step: 0.25, draw: 0.5, cutOff: ['vane_cut_off'] },
    difficulty: {
      story: { name: 'Story', blurb: 'Lighter forces, better pay.', fill: -0.15, allowance: 0.5, pay: 1.5 },
      contract: { name: 'Contract', default: true, blurb: 'The story as written.', fill: 0, allowance: 1, pay: 1 },
      hard: { name: 'Hard', blurb: 'Stronger forces that grow with you, and less money.', fill: 0.15, allowance: 1.5, pay: 0.75 }
    },

    meters: {
      vane: { start: 0, shown: true, name: 'The backer’s Trust', uses: ['pay'], thresholds: [{ gte: 2 }, { lte: -3 }] },
      // how hard the company has been pushed: rises with every hard choice and lost battle, and comes down with rest and care
      fatigue: { start: 0, min: 0, max: 8, shown: true, name: 'Fatigue', uses: ['suppression'], thresholds: [{ gte: 3 }, { gte: 4 }, { gte: 5 }] },
      intel: { start: 1, min: 0, max: 6, shown: true, name: 'Intel', uses: ['reveal', 'intel'], thresholds: [{ gte: 3 }, { gte: 6 }] },
      lead: { start: 0, shown: true, name: 'Lead', thresholds: [{ gte: 3 }, { lte: -3 }] },
      stones: { start: 0, min: 0, max: 7, shown: true, name: 'Lodestones', thresholds: [{ gte: 5 }] },
      theirs: { start: 0, min: 0, max: 7, name: 'The rivals’ lodestones', thresholds: [{ gte: 3 }] },
      alarm: { start: 0, min: 0, max: 10, name: 'Alarm', uses: ['force'], thresholds: [{ gte: 5 }, { gte: 8 }] },
      understanding: { start: 0, min: 0, max: 6, name: 'Understanding', thresholds: [{ gte: 2 }, { gte: 4 }] },
      // each rival's strength (no event lowers some of them in both halves: they are moved by fights and time)
      kettle: { start: 2, min: 0, max: 10, name: 'Brass Ledger', uses: ['force'], twoWay: [] },
      wraith: { start: 2, min: 0, max: 10, name: 'Wraith Section', uses: ['force'], twoWay: [] },
      sable: { start: 2, min: 0, max: 10, name: 'Sable Armour Group', uses: ['force'], twoWay: [] },
      kestrel: { start: 2, min: 0, max: 10, name: 'Kestrel Air Cavalry', uses: ['force'], twoWay: [] },
      reavers: { start: 2, min: 0, max: 10, name: 'The Red Reavers', uses: ['force'], twoWay: [] },
      lance: { start: 2, min: 0, max: 10, name: 'The Ninth Lance', uses: ['force'], twoWay: [] },
      // the hired guns: what each costs, and how far each can be trusted
      kettle_price: { start: 2, min: 0, max: 10, name: 'Brass Ledger’s price', twoWay: [] },
      kestrel_price: { start: 0, min: 0, max: 10, name: 'Kestrel’s price', twoWay: [] },
      reavers_price: { start: 1, min: 0, max: 10, name: 'The Reavers’ price', twoWay: [] },
      sable_price: { start: 0, min: 0, max: 10, name: 'Sable’s price', twoWay: [] },
      kettle_trust: { start: 0, name: 'Brass Ledger’s trust', twoWay: [] },
      kestrel_trust: { start: 0, name: 'Kestrel’s trust', twoWay: [] },
      reavers_trust: { start: 0, name: 'The Reavers’ trust', twoWay: [] },
      sable_trust: { start: 0, name: 'Sable’s trust', twoWay: [] }
    },

    people: {
      // the patron: never in the room, only on the line, and half his face in shadow when he is
      // the backer on Halloran's line: Vane, before anyone knows it (the same face, in shadow)
      client: { name: 'The backer', role: 'On Halloran’s line', face: { bg: '#2a2238', skin: '#e2b48f', hair: '#c8c8c8', hairStyle: 'short', clothes: '#141218', clothesStyle: 'suit', accent: '#c8a040', extras: ['beard'], shadow: true } },
      vane: { name: 'Lucan Vane', role: 'The patron', face: { bg: '#2a2238', skin: '#e2b48f', hair: '#c8c8c8', hairStyle: 'short', clothes: '#141218', clothesStyle: 'suit', accent: '#c8a040', extras: ['beard'], shadow: true } },
      // what stepped out of the air at the beacon: nothing in anybody's files (the first half's unknown contacts)
      unknown: { name: 'Unknown', role: 'No match on any file', face: { tripod: true, bg: '#0e1214', shell: '#5a6a66', glow: '#7ae0c8', shadow: 'full' } },
      kettering: { name: 'Moss Kettering', role: 'Brass Ledger', face: { bg: '#c9a65a', skin: '#c99a76', hair: '#8a8a8a', hairStyle: 'short', clothes: '#5a4a3a', clothesStyle: 'jacket', accent: '#e0b070', extras: ['stubble', 'earring'] } },
      nine: { name: 'Nine', role: 'Wraith Section', face: { bg: '#3a4a5a', skin: '#b88a66', hair: '#222', hairStyle: 'short', hat: 'visor', hatColour: '#1e1e24', clothes: '#2c3440', clothesStyle: 'armour', accent: '#6a8aa0' } },
      agathe: { name: 'Colonel Agathe Sable', role: 'Sable Armour Group', face: { bg: '#8a9a7a', skin: '#e2b48f', hair: '#4a3a2a', hairStyle: 'short', hat: 'helmet', hatColour: '#55604a', clothes: '#4a5240', clothesStyle: 'armour', accent: '#c8a040', extras: ['scar'] } },
      rook: { name: 'Rook Kestrel', role: 'Kestrel Air Cavalry', face: { bg: '#7fb3d9', skin: '#d8a682', hair: '#a0602a', hairStyle: 'short', hat: 'helmet', hatColour: '#3a6a8a', clothes: '#3a4a5a', clothesStyle: 'jacket', accent: '#e8c25a' } },
      hal: { name: 'Big Hal Reaver', role: 'The Red Reavers', face: { bg: '#b04a3a', skin: '#c48a64', hair: '#222', hairStyle: 'bald', clothes: '#4a2a2a', clothesStyle: 'jacket', accent: '#b03a2e', extras: ['beard', 'bandana'], bandana: '#b03a2e' } },
      daw: { name: 'Commander Iselin Daw', role: 'The Ninth Lance', face: { bg: '#5a4a7a', skin: '#e8c0a0', hair: '#2b2622', hairStyle: 'long', hat: 'visor', hatColour: '#2a2238', clothes: '#2a2238', clothesStyle: 'armour', accent: '#c8a040' } },
      seven: { name: 'Seven-Holds-the-Staff', role: 'The Hashamer Esh-Aven', face: { eshaven: true, bg: '#3a2a1a', skin: '#8a8a5a', crest: true, plate: true } },
      ops: { name: 'Company net', role: 'Your radio operator', face: { bg: '#6a8a6a', skin: '#c99a76', hair: '#3a2a1a', hairStyle: 'short', hat: 'cap', hatColour: '#3d4a38', clothes: '#4a5a40', clothesStyle: 'uniform', accent: '#d8c070', extras: ['stubble'] } },
      commander: { name: 'The commander', role: 'Your company', face: { bg: '#8a7a5a', skin: '#c99a76', hair: '#2b2622', hairStyle: 'short', hat: 'cap', hatColour: '#3d4a38', clothes: '#4a5240', clothesStyle: 'uniform', accent: '#e0c25a', extras: ['stubble'] } }
    },
    sides: {
      kettle: { faction: 'pmc', archetype: 'swarm', name: 'Brass Ledger', colour: ['ochre', 'rust'] },
      wraith: { faction: 'pmc', archetype: 'marksmen', name: 'Wraith Section', colour: ['arctic', 'sand'] },
      sable: { faction: 'pmc', archetype: 'armour', name: 'Sable Armour Group', colour: ['charcoal', 'slate'] },
      kestrel: { faction: 'pmc', archetype: 'aircav', name: 'Kestrel Air Cavalry', colour: ['sky', 'steel'] },
      reavers: { faction: 'pmc', archetype: 'shock', name: 'The Red Reavers', colour: ['crimson', 'maroon'] },
      lance: { faction: 'pmc', archetype: 'elite', name: 'The Ninth Lance', colour: ['plum', 'violet'] },
      scavengers: { faction: 'rebel', archetype: 'freespace', name: 'The Thule scavengers' },
      shkar: { faction: 'xeno', archetype: 'shkar', name: 'The Sh’kar' },
      mithdu: { faction: 'xeno', archetype: 'mithdu', name: 'The Mithdu' },
      hashamer: { faction: 'xeno', archetype: 'hashamer', name: 'The Hashamer', skin: 'eshaven' },
      ulvar: { faction: 'xeno', archetype: 'ulvar', name: 'The Ulvar' },
      amt: { faction: 'xeno', archetype: 'amt', name: 'The Amt' }
    },

    /* What time does at each chapter's start: a jump costs 1 kUC unless Vane
       pays for it, the leading rival moves on in the second half, and the Lance
       gathers while Vane suspects. */
    everyChapter: [
      { if: { any: [{ meter: 'vane', lte: 0 }, { flag: 'vane_cut_off' }] }, kUC: -1 },
      { if: { all: [{ chapter: { gte: 7 } }, { chance: 0.25 }] }, meter: 'theirs', add: 1 },
      { if: { all: [{ chapter: { gte: 5 } }, { any: [{ flag: 'vane_suspects' }, { flag: 'vane_cut_off' }] }] }, meter: 'lance', add: 1 },
      { if: { meter: 'intel', gte: 4 }, reveal: 'theirs' }
    ],
    // a company whose heart is not in it: squads pinned before the first shot, in every battle
    beforeBattle: [
      { if: { meter: 'fatigue', eq: 4 }, levers: { suppressOwn: 1 }, note: 'The company is worn out (Fatigue 4): one of your squads starts the battle pinned.' },
      { if: { meter: 'fatigue', gte: 5 }, levers: { suppressOwn: 'D3' }, note: 'The company is worn out (Fatigue 5 or more): D3 of your squads start the battle pinned.' }
    ],
    everyBattle: [
      { if: { grade: 'decisive' }, meter: 'vane', add: 1 },
      // a won battle lifts the company, a lost one grinds it down
      { if: { grade: 'success' }, meter: 'fatigue', add: -1 },
      { if: { grade: 'failure' }, meter: 'fatigue', add: 1 }
    ],

    threads: {
      race: { name: 'The Race', pressure: [{ flag: 'ledger_has_log', w: 2 }, { meter: 'theirs', w: 0.5 }, { meter: 'lead', w: -0.5 }, { flag: 'wraith_robbed', w: 1 }, { flag: 'kestrel_filmed', w: 1 }, { flag: 'chart_sold', w: 2 }] },
      tribes: { name: 'The Tribes', pressure: [{ meter: 'alarm', w: 1 }, { flag: 'warren_entered', w: 2 }, { flag: 'hoard_taken', w: 1 }, { flag: 'alpha_taken', w: 1 }, { flag: 'beacon_stormed', w: 1 }] },
      contact: { name: 'First Contact', finale: false, pressure: [{ meter: 'understanding', w: 1 }, { flag: 'relics_returned', w: 2 }, { flag: 'thule_records', w: 1 }, { flag: 'eshaven_graves', w: 1 }, { flag: 'beacon_rubbing', w: 2 }] },
      // (a base of its own: a patron who is content is still a patron with his own designs on the Quiet; without it The Patron was offered in one walk in twenty, storydrwhole.js)
      patron: { name: 'The Patron', pressure: [{ w: 2 }, { meter: 'vane', w: -1 }, { meter: 'lance', w: 0.5 }, { flag: 'vane_suspects', w: 2 }, { flag: 'vane_cut_off', w: 3 }, { flag: 'owed_vane', w: 1 }] }
    },
    picks: 3,
    /* The Race is run against the leading rival: the strongest of these when a
       chapter that asks for one begins (story.js leadingRival), Kestrel first on a
       tie (it always gets there first), each fielding its own force. */
    leading: { from: ['kestrel', 'kettle', 'wraith', 'sable', 'reavers'], unless: { kettle: 'kettle_partner' } },
    /* Who each rival company works for. Every one is a secret at the start: the
       star chart says "client unknown" until something reveals it
       ({ reveal: 'client_<id>' }, with the journal's line for it). */
    // the rivals who take a beating personally: beat_<id> once the company has won against them (story.js resolveBattle)
    grudges: ['kettle', 'wraith', 'sable', 'kestrel', 'reavers', 'lance'],
    clients: {
      kettle: 'the Orrin Mercantile Bank', wraith: 'the Admiralty’s Office of Naval Intelligence', sable: 'the Halvorsen Mining Combine',
      kestrel: 'the Meridian newsfeed', reavers: 'nobody: claim jumpers', lance: 'Lucan Vane'
    },
    rivals: { kestrel: rival('kestrel'), kettle: rival('kettle'), wraith: rival('wraith'), sable: rival('sable'), reavers: rival('reavers') },
    // the Quiet wakes: whatever finale was due, it is Recall
    finaleOverride: [{ if: { meter: 'alarm', gte: 8 }, chapter: 'recall' }],

    /* ---------- side contracts, to pay for the jumps ---------- */
    side: {
      offers: { base: 1, behind: 2, cutOff: 2 }, cutOffPay: 1.5, cutOff: ['vane_cut_off'],
      curve: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3 },
      /* how a job's pay and its cost in time are told on the page, as story
         (the pay by how much: the first band it is at or under) */
      words: {
        pay: [[2, 'It pays a little.'], [3, 'It pays fairly.'], [4, 'It pays well.'], [99, 'It pays handsomely.']],
        catchUp: 'The company is behind, and this one is on its way: it costs no time.',
        late: 'Every day spent off the trail now is a day the rivals gain on it.'
      },
      jobs: [
        { id: 'escort', title: 'Escort to the Yards', pay: 3, text: 'A freighter through claim-jumper space.',
          ask: 'A freighter captain on the dock has a hold full of reactor parts, a route through claim-jumper space, and nobody to ride with her. She will pay well for company.', take: 'Ride shotgun to the yards.',
          scenario: 'meeting', tier: 'max-1', enemy: rival('reavers', { fill: { to: 0.7, from: ['irregulars', 'enforcers'] } }),
          cost: [LATE_TIME], on: { success: [{ effects: [{ meter: 'reavers', add: -1 }] }], failure: [{}] } },
        { id: 'jumpers', title: 'Claim Jumpers’ Bounty', pay: 3, if: { chapter: { gte: 2 } },
          text: 'A bounty on a Red Reavers crew. Their captain is asking to talk.', who: 'hal',
          ask: 'The port has put a bounty on a Red Reavers crew. Their captain has already sent word through Big Hal: she would rather talk than die, and she would rather the company collected than anyone else.', take: 'Go and collect, and hear her out.',
          scenario: 'secure', tier: 'max-1', enemy: rival('reavers', { fill: { to: 0.7, from: ['irregulars', 'enforcers'] } }),
          cost: [LATE_TIME], on: { success: [{ effects: [{ flag: 'reavers_spared' }, { meter: 'reavers', add: -1 }] }], failure: [{ effects: [{ meter: 'reavers', add: 1 }] }] } },
        { id: 'salvage', title: 'Salvage Dispute', pay: 4, text: 'Two claims on one wreck, and yours is the bigger gun.',
          ask: 'Two crews have filed claims on the same wreck, and one of them is Brass Ledger. The other would like a bigger gun on its side of the argument.', take: 'Be the bigger gun.',
          scenario: 'find', tier: 'max-1', enemy: rival('kettle', { fill: { to: 0.7, from: ['recruits', 'irregulars'] } }),
          cost: [LATE_TIME], on: { success: [{ effects: [{ meter: 'kettle', add: -1 }] }], failure: [{}] } },
        { id: 'village', title: 'The Village', pay: 2, if: { played: 'mimics' },
          text: 'A Hashamer village, and Brass Ledger’s slavers on the ridge.', who: 'seven',
          ask: 'Seven-Holds-the-Staff sends word, carefully, in your own language: Brass Ledger’s trucks are on the ridge above another village, and the cages are empty.', take: 'Go to the village.', passedText: 'If nobody comes, the Hashamer will know who did not.',
          scenario: 'meeting', tier: 'max-1', enemy: rival('kettle', { fill: { to: 0.6, from: ['recruits', 'irregulars'] } }),
          cost: [LATE_TIME], passed: [{ meter: 'understanding', add: -1 }],
          on: { success: [{ effects: [{ meter: 'understanding', add: 1 }] }], failure: [{ effects: [{ meter: 'understanding', add: -1 }] }] } },
        { id: 'survey', title: 'Survey Cover', pay: 3, if: { chapter: { gte: 5 } }, text: 'A survey team on a quiet world, and the ground moving under them.',
          takeText: 'Whatever is in that ground will know the company has been there.',
          ask: 'A survey team on a quiet world says the ground is moving under them, and something is moving in it. They have stopped sleeping, and they are paying for company.', take: 'Go and keep the surveyors company.',
          scenario: 'ce_clear', tier: 'max-1', enemy: tribe('mithdu', { fill: { to: 0.6, from: ['xeps1'] } }),
          cost: [LATE_TIME, { meter: 'alarm', add: 1 }], on: { success: [{}], failure: [{ effects: [{ meter: 'alarm', add: 1 }] }] } },
        { id: 'errand', title: 'The Backer’s Errand', pay: 4, if: { all: [{ meter: 'vane', gte: 1 }, { not: { flag: 'vane_cut_off' } }] },
          text: 'Halloran’s backer wants something collected, and someone is sitting on it.', who: 'client',
          ask: 'Halloran’s backer wants something collected from people who do not want to give it up. He does not say what it is. He pays as if it matters.', take: 'Collect it for him.',
          scenario: 'find', tier: 'max-1', enemy: rival('wraith', { fill: { to: 0.7, from: ['irregulars', 'observers'] } }),
          cost: [LATE_TIME], on: { success: [{ effects: [{ meter: 'vane', add: 1 }] }], failure: [{ effects: [{ meter: 'vane', add: -1 }] }] } },
        { id: 'creditor', title: 'Any Port in a Storm', pay: 4, if: { flag: 'vane_cut_off' },
          text: 'One of the backer’s creditors wants his company hurt, and pays well for it.',
          ask: 'One of the backer’s creditors has noticed that the company no longer works for him, and would pay well to see his own company bloodied.', take: 'Take the creditor’s money.',
          scenario: 'demolish', tier: 'max-1', role: 'attacker', enemy: rival('lance', { fill: { to: 0.7, from: ['recruits', 'rookie'] } }),
          cost: [LATE_TIME], on: { success: [{ effects: [{ meter: 'lance', add: -1 }] }], failure: [{ effects: [{ meter: 'lance', add: 1 }] }] } }
      ]
    },

    chapters: [
      /* ================= the first half: The Chart ================= */
      { id: 'c1', half: 1, title: 'Lot 47', place: { system: 'Hadley', planet: 'Vesk', kind: 'dense', site: 'Vesk Free Port' },
        intro: 'A dead surveyor’s log comes up for auction, and a reader called Halloran hires the company to make sure he leaves with it.', nodes: [
        { id: 'c1.brief', type: 'brief', text: 'Vesk Free Port. Lot 47 is on the block tonight.', next: 'c1.bidding' },
        { id: 'c1.bidding', type: 'event', who: 'reader', title: 'The bidding', text: 'Half the room is bidding for somebody else.', options: [
          /* (the backer's money, not the company's: the company has none yet)
             Three ways out across the square: seen at Halloran's side all evening, the company walks into Brass Ledger's
             ambush; watching the room, it sees the ambush laid and walks into it ready; marking Kettering's men, it hits them first. */
          { id: 'outbid', text: 'Stand with Halloran.', battle: { variant: { ambush: 'enemy', ground: 'caught' } }, effects: [{ meter: 'vane', add: 1 }, { flag: 'caught_out', local: true }] },
          { id: 'watch', text: 'Stay in the background and observe.', battle: { variant: { ambush: 'enemy', expected: true, ground: 'expected' } }, effects: [{ meter: 'intel', add: 1 }, { flag: 'room_watched', local: true }] },
          { id: 'follow', text: 'Focus on Kettering, and mark his men.', battle: { variant: { ambush: 'player', ground: 'strike' } }, effects: [{ flag: 'kettle_marked', local: true }] }
        ], next: 'c1.battle' },
        // Halloran across the market square to the landing field, with the log, and Brass Ledger in the way
        { id: 'c1.battle', type: 'battle', scenario: 'escort', variant: { escort: 'Halloran' }, map: 'vesk', tier: 1, pl: 1, planet: 'dense',
          enemy: rival('kettle', { drop: ['kestrel_filmed', 'beat_kettle', 'agent_jailed'], core: [{ key: 'recruits', name: 'Kettering’s Own' }], optional: { meter: 'kettle', per: 3, units: ['irregulars', 'recruits'] }, fill: { to: 0.6, from: ['recruits', 'irregulars'], meter: 'kettle', step: 0.05 },
            changes: [{ if: { flag: 'kettle_marked' }, readiness: -1 }] }),
          // the room watched: the company saw who was interested, and where they might wait
          adjust: [{ if: { flag: 'room_watched' }, levers: { intel: 1 } }],
          // lost, Brass Ledger have the log, and what the company does next is about getting it back, or following it
          // (caught out and still won through: the backer pays extra for it)
          on: { success: [{ effects: [{ meter: 'kettle', add: -1 }, { meter: 'lead', add: 1 }, { if: { flag: 'caught_out' }, kUC: 2, journal: 'Halloran’s backer pays the company 2 kUC extra for the way it dealt with the ambush in the square.' }] }], failure: [{ effects: [{ meter: 'lead', add: -1 }, { flag: 'log_lost' }] }] }, next: 'c1.debrief' },
        { id: 'c1.debrief', type: 'debrief', text: '{if success}The log is safe.{/if}{if failure}Brass Ledger have the log.{/if}', events: ['c1.agent'], next: 'c1.route' },
        { id: 'c1.route', type: 'branch', when: [{ if: { flag: 'log_lost' }, next: 'c1.lost' }, { next: 'c1.interlude' }] },
        /* The log lost: Brass Ledger's ship is on the landing field, and the company
           can hit it before it lifts, have Vane buy the log back, or let it go and
           follow it, with only the pages Halloran photographed. */
        { id: 'c1.lost', type: 'event', who: 'kettering', title: 'The log is gone', text: 'Brass Ledger have the log, and a ship on the landing field.', options: [
          { id: 'raid', text: 'Hit their ship before it lifts.', next: 'c1r.battle' },
          // (no money changes hands: the price is paid at the end of the road, where Brass Ledger take their share of the claim)
          { id: 'cutin', text: 'Cut Kettering in on the claim.', effects: [{ flag: 'kettle_partner' }, { flag: 'kettle_contact' }, { meter: 'kettle_trust', add: 2 }, { meter: 'vane', add: -1 }, { flag: 'log_lost', set: false }], next: 'c1.interlude' },
          { id: 'follow', text: 'Let them run with it, and follow.', effects: [{ meter: 'theirs', add: 1 }, { meter: 'lead', add: -1 }, { flag: 'log_lost', set: false }, { flag: 'ledger_has_log' }], next: 'c1.interlude' }
        ], next: 'c1.interlude' },
        // the log, carried off their ship (the relic variant): back in the company's hands, or gone with Brass Ledger
        { id: 'c1r.battle', type: 'battle', scenario: 'find', map: 'veskfield', tier: 1, pl: 1, planet: 'dense', variant: { relic: true },
          enemy: rival('kettle', { drop: ['kestrel_filmed', 'beat_kettle'], core: [{ key: 'recruits', name: 'Kettering’s Own' }], optional: { meter: 'kettle', per: 3, units: ['irregulars', 'recruits'] }, fill: { to: 0.6, from: ['recruits', 'irregulars'], meter: 'kettle', step: 0.05 }, changes: [{ if: { flag: 'kettle_marked' }, readiness: -1 }] }),
          on: {
            success: [{ if: { relic: 'A' }, effects: [{ meter: 'kettle', add: -1 }, { flag: 'log_lost', set: false }] }, { effects: [{ meter: 'theirs', add: 1 }, { flag: 'log_lost', set: false }, { flag: 'ledger_has_log' }] }],
            failure: [{ if: { relic: 'A' }, effects: [{ flag: 'log_lost', set: false }] }, { effects: [{ meter: 'theirs', add: 1 }, { flag: 'log_lost', set: false }, { flag: 'ledger_has_log' }] }]
          }, next: 'c1r.debrief' },
        { id: 'c1r.debrief', type: 'debrief', text: '{if relic}The log is back.{/if}{if not relic}Brass Ledger lift off with the log.{/if}', events: [], next: 'c1.interlude' },
        { id: 'c1.agent', type: 'event', who: 'kettering', title: 'The agent', text: 'Brass Ledger’s man is in the company’s hands.', options: [
          { id: 'message', text: 'Let him go, with a message for his employer.', effects: [{ flag: 'kettle_contact' }, { meter: 'vane', add: -1 }] },
          { id: 'interrogate', text: 'Interrogate him.', effects: [{ meter: 'intel', add: 1 }, { meter: 'kettle_trust', add: -1 }, { flag: 'kettle_contact' }, { reveal: 'client_kettle', journal: 'Brass Ledger’s client this time: the Orrin Mercantile Bank of Kerrigan, behind three shell companies. Next time it will be whoever pays.' }] },
          { id: 'authorities', text: 'Hand him to the port authorities.', effects: [{ meter: 'vane', add: 1 }, { meter: 'kettle', add: -1 }, { meter: 'kettle_trust', add: -2 }, { flag: 'kettle_burned' }, { flag: 'agent_jailed' }] }
        ] },
        interlude('c1.interlude', 'c2', 'The company lifts off Vesk with the log, and Morrow’s first heading.')
      ] },

      { id: 'c2', half: 1, title: 'The First Lodestone', intro: 'Morrow’s first heading can be read two ways, and the company can only follow one.', nodes: [
        { id: 'c2.brief', type: 'brief', text: 'Two readings of the first heading.', next: 'c2.readings' },
        { id: 'c2.readings', type: 'event', who: 'reader', title: 'Two readings', text: 'The Glass Flats, or Station Thule. A rival will take the other.', options: [
          { id: 'flats', text: 'The Glass Flats: Morrow’s dig.', effects: [{ meter: 'theirs', add: 1 }, { meter: 'sable', add: 1 }, { flag: 'eshaven_graves' }], next: 'c2f.dig' },
          { id: 'thule', text: 'Station Thule: the relay he stopped at.', effects: [{ meter: 'theirs', add: 1 }, { meter: 'wraith', add: 1 }, { meter: 'lead', add: -1 }], next: 'c2t.airlock' }
        ] },
        // the Glass Flats
        { id: 'c2f.dig', type: 'event', who: 'nine', title: 'The dig', text: 'Wraith Section’s camp is already on the flats.', options: [
          { id: 'night', text: 'Dig at night.', battle: { tier: 'max-1', readiness: -1 } },
          { id: 'jam', text: 'Jam their comms first.', cost: { intel: 1 }, why: 'You’d need Intel to spend.', battle: { suppressOwn: 0, strikes: 'D3' } },
          { id: 'rush', text: 'Go straight for the dig.', battle: { role: 'attacker' }, effects: [{ flag: 'glassflats_rushed', local: true }] }
        ], next: 'c2f.battle' },
        // (a battle can have a place of its own: the chapter's two sites are worlds apart)
        // (the relic variant: the lodestone is dug up, and whoever carries it off, or holds it at the end, has it)
        { id: 'c2f.battle', type: 'battle', scenario: 'find', map: 'glassflats', tier: 'max', pl: 1, planet: 'desert', variant: { relic: true },
          place: { system: 'Vantor', planet: 'Vantor III', kind: 'desert', world: { gravity: 'low' }, site: 'the Glass Flats' },
          enemy: rival('wraith', { drop: ['kestrel_filmed', 'beat_wraith'], changes: [{ if: { flag: 'glassflats_rushed' }, readiness: -1 }] }),
          on: {
            success: [{ if: { relic: 'A' }, effects: [{ meter: 'stones', add: 1 }, { meter: 'wraith', add: -1 }] },
                      { if: { relic: 'B' }, effects: [{ meter: 'theirs', add: 1 }, { meter: 'wraith', add: -1 }] }, { effects: [{ meter: 'wraith', add: -1 }] }],
            failure: [{ if: { relic: 'A' }, effects: [{ meter: 'stones', add: 1 }] }, { if: { relic: 'B' }, effects: [{ meter: 'theirs', add: 1 }] }, {}]
          }, next: 'c2f.debrief' },
        { id: 'c2f.debrief', type: 'debrief', text: '{if relic}The lodestone is yours.{/if}{if not relic}You come away without the lodestone.{/if}', events: ['c2f.drop', 'c2f.second'], next: 'c2.interlude' },
        { id: 'c2f.drop', type: 'event', who: 'nine', if: { grade: 'success' }, title: 'Wraith’s dead drop', text: 'Their camp holds a copy of their own orders.', options: [
          { id: 'read', text: 'Read them.', effects: [{ meter: 'intel', add: 2 }, { flag: 'wraith_orders' }, { reveal: 'client_wraith', journal: 'Wraith Section’s orders come from the Admiralty’s Office of Naval Intelligence. The Navy wants the Quiet too.' }] },
          { id: 'warn', text: 'Leave a message in it.', effects: [{ meter: 'wraith', add: -1 }, { flag: 'wraith_warned' }] },
          { id: 'take', text: 'Take back their stolen copy of the log.', effects: [{ meter: 'lead', add: 1 }, { flag: 'wraith_robbed' }].concat(rebuilt('Wraith Section’s copy')) }
        ] },
        { id: 'c2f.second', type: 'event', if: { not: { relic: 'A' } }, title: 'Second best', text: 'The lodestone got away from you.', options: [
          { id: 'chase', text: 'Follow their dropship.', effects: [{ meter: 'lead', add: 1 }, { meter: 'fatigue', add: 1 }] },
          { id: 'dig', text: 'Let it go, and dig on.', effects: [{ meter: 'intel', add: 1 }] }
        ] },
        // Station Thule
        { id: 'c2t.airlock', type: 'event', title: 'The airlock', text: 'The scavengers have welded the station’s docking arms shut.', options: [
          { id: 'cut', text: 'Cut through a docking arm’s seal.', battle: { role: 'attacker' } },
          { id: 'hatch', text: 'Find Morrow’s maintenance hatch in the log.', effects: [{ roll: { d6: 4, meter: 'intel' },
            pass: [{ next: { battle: 'c2t.battle', levers: { role: 'choose' } } }], fail: [{ next: { battle: 'c2t.battle', levers: { readiness: 1 } } }] }] },
          { id: 'pay', text: 'Pay for access.', cost: { kUC: 2 }, why: 'You can’t pay them.', battle: { skip: true }, effects: [{ meter: 'lead', add: -1 }, { meter: 'fatigue', add: -1 }] }
        ], next: 'c2t.battle' },
        { id: 'c2t.battle', type: 'battle', scenario: 'ce_control', map: 'thule', tier: 'max', pl: 1, planet: 'arctic',
          place: { system: 'Okoro', planet: 'Okoro II', kind: 'arctic', world: { atmosphere: 'none' }, site: 'Station Thule' },
          // (the scavengers aboard: militia and salvage crews on foot, nothing that cannot fight in a corridor)
          enemy: { side: 'scavengers', faction: 'rebel', archetype: 'freespace', core: ['rmilitia', 'rminers'], optional: { meter: 'kettle', per: 3, units: ['rmilitia', 'rlmg'] }, fill: { to: 0.8, from: ['rmilitia', 'rminers', 'rciv', 'rlmg'] } },
          on: { success: [{ effects: [{ meter: 'stones', add: 1 }] }], skip: [{ effects: [{ meter: 'stones', add: 1 }] }], failure: [{}] }, next: 'c2t.debrief' },
        { id: 'c2t.debrief', type: 'debrief', text: '{if success}The station is yours.{/if}{if skip}The scavengers take the money and open the lock.{/if}{if failure}The scavengers fired the archive.{/if}', events: ['c2t.records', 'c2t.burned'], next: 'c2.interlude' },
        { id: 'c2t.records', type: 'event', if: { grade: ['decisive', 'victory', 'skip'] }, title: 'Morrow’s records', text: 'The relay kept his log entries, his voice and his fear.', options: [
          { id: 'listen', text: 'Listen to all of it.', effects: [{ meter: 'understanding', add: 1 }, { flag: 'thule_records' }].concat(rebuilt('Morrow’s own records at Thule')) },
          { id: 'send', text: 'Send the records to the backer.', effects: [{ meter: 'vane', add: 1 }].concat(rebuilt('Morrow’s own records at Thule, with his client’s readers')) },
          { id: 'sell', text: 'Sell a copy to a newsfeed.', effects: [{ kUC: 2 }, { flag: 'kestrel_deal' }, { meter: 'vane', add: -1 }] }
        ] },
        { id: 'c2t.burned', type: 'event', if: { grade: 'failure' }, title: 'Burned', text: 'The scavengers fired the archive.', options: [
          { id: 'sift', text: 'Sift the ashes.', effects: [{ meter: 'lead', add: -1 }, { roll: { d6: 4, meter: 'intel' }, pass: [{ meter: 'stones', add: 1 }] }] },
          { id: 'go', text: 'Take what’s left and go.', effects: [{ meter: 'lead', add: 1 }] }
        ] },
        interlude('c2.interlude', 'c3')
      ] },

      { id: 'c3', half: 1, title: 'The Drowned Beacon', place: { system: 'Tessaly', planet: 'Tessaly IV', kind: 'jungle', world: { atmosphere: 'foggy' }, site: 'the Mire' },
        intro: 'Morrow’s beacon is a structure nobody built, half under water, and the Red Reavers are digging at it.', nodes: [
        { id: 'c3.brief', type: 'brief', text: 'The beacon, in the flooded forest.', next: 'c3.route0' },
        /* The log still Brass Ledger's (c1.lost): they have brought it here, to sell
           to the Reavers digging at the beacon. A second chance at it, before Kerrigan. */
        { id: 'c3.route0', type: 'branch', when: [{ if: { flag: 'ledger_has_log' }, next: 'c3.sale' }, { next: 'c3.contact' }] },
        { id: 'c3.sale', type: 'event', who: 'kettering', title: 'The private sale', text: 'Brass Ledger are selling the log to the Reavers, here.', options: [
          { id: 'raid', text: 'Break up the sale.', next: 'c3s.battle' },
          { id: 'wait', text: 'Let it go through, and wait for Kerrigan.', effects: [{ meter: 'reavers', add: 1 }], next: 'c3.contact' }
        ], next: 'c3.contact' },
        { id: 'c3s.battle', type: 'battle', scenario: 'find', map: 'mudbank', tier: 'max', pl: 1, planet: 'jungle', variant: { relic: true }, enemy: rival('kettle', { drop: ['kestrel_filmed'] }),
          on: { success: [{ if: { relic: 'A' }, effects: [{ meter: 'kettle', add: -1 }].concat(LOG_BACK) }, { effects: [{ meter: 'reavers', add: 1 }] }],
                failure: [{ if: { relic: 'A' }, effects: LOG_BACK }, { effects: [{ meter: 'reavers', add: 1 }] }] }, next: 'c3s.debrief' },
        { id: 'c3s.debrief', type: 'debrief', text: '{if relic}The log is back.{/if}{if not relic}The sale goes through.{/if}', events: [], next: 'c3.contact' },
        { id: 'c3.contact', type: 'event', who: 'hal', title: 'Claim jumpers', text: 'The Reavers are digging at the beacon.', options: [
          { id: 'storm', text: 'Storm it.', battle: { scenario: 'strike', name: 'Storm the Beacon' }, effects: [{ meter: 'alarm', add: 1 }, { flag: 'beacon_stormed' }, { reveal: 'client_reavers', journal: 'The Red Reavers work for nobody. They are claim jumpers, and sell to whoever buys.' }] },
          { id: 'watch', text: 'Watch first.', battle: { tier: 'max-1' }, effects: [{ meter: 'understanding', add: 1 }, { meter: 'intel', add: 1 }, { meter: 'lead', add: -1 }, { reveal: 'client_reavers', journal: 'The Red Reavers work for nobody. They are claim jumpers, and sell to whoever buys.' }] },
          { id: 'signal', text: 'Try a signal.', effects: [{ reveal: 'client_reavers', journal: 'The Red Reavers work for nobody. They are claim jumpers, and sell to whoever buys.' }, { roll: { d6: 4, meter: 'understanding', mods: [{ if: { flag: 'thule_records' }, add: 1 }] },
            pass: [{ flag: 'beacon_rubbing' }, { meter: 'alarm', add: -1 }, { meter: 'stones', add: 1 }, { next: { battle: 'c3.battle', levers: { skip: true } } }],
            fail: [{ flag: 'signal_failed', local: true }, { next: { battle: 'c3.battle', levers: { variant: { contacts: { turn: 2, found: true, keys: CONTACTS } }, name: 'The Beacon Answers' } } }] }] }
        ], next: 'c3.battle' },
        /* (the relic variant: the beacon's lodestone, prised out of its socket and carried off, or not;
           and once it is found, or by turn 4, the Reavers run and the beacon's keepers step out of the air: unknown contacts) */
        { id: 'c3.battle', type: 'battle', scenario: 'find', map: 'mire', tier: 'max', pl: 1, planet: 'jungle', variant: { relic: true, contacts: { turn: 4, found: true, keys: CONTACTS } },
          enemy: rival('reavers', { drop: ['kestrel_filmed'], fill: { to: 0.7, from: ['irregulars', 'enforcers'] } }),
          on: { success: [{ if: { relic: 'A' }, effects: [{ meter: 'stones', add: 1 }, { meter: 'alarm', add: 1 }] }, {}],
                failure: [{ if: { relic: 'A' }, effects: [{ meter: 'stones', add: 1 }, { meter: 'alarm', add: 2 }] }, { effects: [{ meter: 'alarm', add: 1 }] }] }, next: 'c3.debrief' },
        { id: 'c3.debrief', type: 'debrief', pick: 2, text: '{if success}The beacon is quiet.{/if}{if skip}The beacon answers, and lets you go.{/if}{if failure}Whatever they were, they drove you off.{/if}', events: ['c3.left', 'c3.copy'], next: 'c3.end' },
        { id: 'c3.left', type: 'event', if: { all: [{ not: { flag: 'beacon_rubbing' } }, { not: { relic: 'A' } }] }, title: 'What they left', text: 'One of them, hurt, and the lodestone still in its socket.', options: [
          { id: 'stone', text: 'Take the lodestone.', effects: [{ meter: 'stones', add: 1 }, { meter: 'alarm', add: 1 }] },
          { id: 'leave', text: 'Leave the stone, and the hurt one, where they are.', effects: [{ meter: 'understanding', add: 2 }, { meter: 'lead', add: -1 }, { meter: 'vane', add: -1 }, { flag: 'relics_returned' }] },
          { id: 'both', text: 'Take both, for the backer.', effects: [{ meter: 'stones', add: 1 }, { meter: 'alarm', add: 2 }, { meter: 'vane', add: 1 }, { meter: 'understanding', add: -1 }, { flag: 'alpha_taken' }] },
          { id: 'gate', text: 'The gate is still open. Step through after them.', extreme: true, if: { any: [{ flag: 'beacon_stormed' }, { flag: 'signal_failed' }] },
            why: 'The air closed behind them.', effects: [{ flag: 'warren_entered' }, { meter: 'alarm', add: 2 }] }
        ] },
        { id: 'c3.copy', type: 'event', who: 'kettering', title: 'A buyer for a copy', text: 'Someone wants a copy of the chart, and names a price.', options: [
          { id: 'sell', text: 'Sell them a copy.', extreme: true, if: { meter: 'vane', lte: -1 }, why: 'You still work for the backer.', effects: [{ kUC: 4 }, { meter: 'theirs', add: 1 }, { flag: 'chart_sold' }] },
          { id: 'refuse', text: 'Refuse.', effects: [{ meter: 'vane', add: 1 }] },
          { id: 'report', text: 'Tell the backer who asked.', effects: [{ meter: 'vane', add: 1 }, { meter: 'kettle', add: -1 }] }
        ] },
        // both one-offs triggered: the Warren wins, and Vane only suspects
        { id: 'c3.end', type: 'happening', effects: [
          { if: { all: [{ flag: 'warren_entered' }, { any: [{ flag: 'chart_sold' }, { meter: 'vane', lte: -3 }] }] }, flag: 'vane_suspects' }
        ], next: 'c3.route' },
        { id: 'c3.route', type: 'branch', when: [
          { if: { flag: 'warren_entered' }, next: 'warren' },
          { if: { any: [{ flag: 'chart_sold' }, { meter: 'vane', lte: -3 }] }, next: 'doublecross' },
          { next: 'c3.interlude' }
        ] },
        interlude('c3.interlude', 'c4')
      ] },

      { id: 'c4', half: 1, title: 'The Broker', place: { system: 'Marrick', planet: 'Kerrigan', kind: 'industrial', site: 'the docks' },
        intro: 'The next heading is for sale again, to everyone, from inside Sable’s warehouse.', nodes: [
        { id: 'c4.brief', type: 'brief', text: 'Kerrigan. The broker’s auction.', next: 'c4.lot' },
        { id: 'c4.lot', type: 'event', who: 'agathe', title: 'Lot 47, again', text: 'Sable has bought the warehouse the heading sits in.', options: [
          // (the heading can be bought; the log cannot: it comes back only with the warehouse taken)
          { id: 'buy', text: 'Buy it.', cost: { kUC: 6 }, why: 'You can’t afford it.', battle: { skip: true }, effects: [{ meter: 'vane', add: 1 }] },
          { id: 'take', text: 'Take it.', if: { meter: 'fatigue', lte: 2 }, why: 'The company is too worn out to go at Sable’s tanks.', battle: { role: 'attacker', tier: 'max' } },
          { id: 'follow', text: 'Let Sable have it, and follow Sable.', battle: { skip: true, intel: 2 }, effects: [{ flag: 'c4_followed', local: true }, { meter: 'lead', add: -1 }, { meter: 'intel', add: 2 }, { meter: 'vane', add: -1 }, { meter: 'sable', add: 1 }, { flag: 'sable_owed' }, { reveal: 'client_sable', journal: 'Sable Armour Group belongs to the Halvorsen Mining Combine, bought and paid for, its accounts kept on Halcyon.' }] },
          Object.assign(hireOption('kettle', 'Hire Brass Ledger for the takeover.'), { if: { all: [HIRE_IF.kettle, { not: { flag: 'ledger_has_log' } }] }, why: 'Brass Ledger won’t fight for you while they hold the log.' })
        ], next: 'c4.battle' },
        { id: 'c4.battle', type: 'battle', scenario: 'takeover', map: 'docks', role: 'attacker', tier: 'max', pl: 1, planet: 'industrial', enemy: rival('sable', { drop: ['kestrel_filmed', 'beat_sable'] }),
          on: { success: [{ effects: [{ meter: 'stones', add: 1 }, { meter: 'sable', add: -1 }, { meter: 'lead', add: 1 }, { reveal: 'client_sable', journal: 'Sable Armour Group belongs to the Halvorsen Mining Combine, bought and paid for, its accounts kept on Halcyon.' }].concat(LOG_BACK) }], skip: [{ if: { flag: 'c4_followed' }, effects: [{ meter: 'theirs', add: 1 }] }, { effects: [{ meter: 'stones', add: 1 }] }], failure: [{ effects: [{ meter: 'theirs', add: 1 }] }] }, next: 'c4.debrief' },
        { id: 'c4.debrief', type: 'debrief', pick: 3, text: 'The heading is out, one way or another.', events: ['c4.copies'].concat(HIRED_EVENTS), next: 'c4.interlude' },
        { id: 'c4.copies', type: 'event', title: 'The broker’s copies', text: 'Everybody bought one.', options: [
          { id: 'burn', text: 'Burn his stock.', effects: [{ meter: 'lead', add: 1 }, { meter: 'kettle', add: -1 }] },
          { id: 'buyall', text: 'Buy them all.', cost: { kUC: 2 }, why: 'You can’t afford it.', effects: [{ meter: 'theirs', add: -1 }] },
          { id: 'let', text: 'Let them go.', effects: [{ meter: 'theirs', add: 1 }] }
        ] },
        interlude('c4.interlude', 'fault')
      ] },

      { id: 'warren', half: 1, oneOff: true, title: 'Into the Warren', place: { system: '(no fix)', planet: 'the Warren', kind: 'unstable', world: { anomaly: 'radiation' } },
        intro: 'The company is through the gate, on a world nobody has charted, underground.', nodes: [
        { id: 'warren.brief', type: 'brief', text: 'Tunnels, on the far side of the gate.', next: 'warren.other' },
        { id: 'warren.other', type: 'event', title: 'The other side', text: 'The turret is closing behind the company.', options: [
          { id: 'hold', text: 'Hold the gate open with charges.', battle: { strikes: 'D3' }, effects: [{ meter: 'alarm', add: 1 }] },
          { id: 'close', text: 'Let it close.', battle: { suppressOwn: 'D3' }, effects: [{ meter: 'understanding', add: 1 }] },
          { id: 'voices', text: 'Follow the voices.', if: { meter: 'fatigue', lte: 2 }, why: 'The company is too worn out to go any deeper.', effects: [{ roll: { d6: 4, meter: 'understanding' },
            pass: [{ next: { battle: 'warren.battle', levers: { tier: 'max-1' } } }], fail: [{ next: { battle: 'warren.battle', levers: { variant: { ambush: true } } } }] }] }
        ], next: 'warren.battle' },
        // (the Reavers went through first, after the hoard; by turn 3 the tunnels' keepers come out of the walls: unknown contacts)
        { id: 'warren.battle', type: 'battle', scenario: 'ce_clear', map: 'warren', tier: 'max', pl: 1, planet: 'unstable', variant: { contacts: { turn: 3, keys: CONTACTS_DEEP } },
          enemy: rival('reavers', { drop: ['kestrel_filmed'], fill: { to: 0.7, from: ['irregulars', 'enforcers'] } }),
          on: { success: [{}], failure: [{ effects: [{ meter: 'alarm', add: 2 }] }] }, next: 'warren.debrief' },
        { id: 'warren.debrief', type: 'debrief', text: 'The company is out, the long way round.', events: ['warren.hoard'], next: 'warren.interlude' },
        { id: 'warren.hoard', type: 'event', title: 'The hoard', text: 'A chamber of relics, and a lodestone no rival will ever know about.', options: [
          { id: 'stone', text: 'Take the lodestone only.', effects: [{ meter: 'stones', add: 1 }, { meter: 'lead', add: 1 }] },
          { id: 'all', text: 'Take everything you can carry.', effects: [{ kUC: 4 }, { meter: 'stones', add: 1 }, { meter: 'alarm', add: 2 }, { flag: 'hoard_taken' }] },
          { id: 'mark', text: 'Take nothing, and mark the way.', effects: [{ meter: 'understanding', add: 2 }, { meter: 'alarm', add: -1 }, { flag: 'mithdu_marked' }] }
        ] },
        interlude('warren.interlude', 'fault')
      ] },

      { id: 'doublecross', half: 1, oneOff: true, title: 'The Double-Cross', place: { system: 'Marrick', planet: 'Kerrigan orbital', kind: 'industrial', world: { gravity: 'high' } },
        intro: 'A company called the Ninth Lance docks beside the company’s, with a court order.', nodes: [
        { id: 'dx.brief', type: 'brief', text: 'The Ninth Lance, and a repossession.', next: 'dx.repo' },
        { id: 'dx.repo', type: 'event', who: 'daw', title: 'The repossession', text: 'Commander Daw wants the log.', options: [
          { id: 'hand', text: 'Hand back the log.', battle: { skip: true }, effects: [{ meter: 'lead', add: -2 }, { meter: 'intel', add: -2 }, { flag: 'vane_cut_off' }, { flag: 'log_handed' }, { reveal: 'client_lance', journal: 'The Ninth Lance is Lucan Vane’s own company.' }] },
          { id: 'refuse', text: 'Refuse.', battle: { role: 'choose', edge: 'choose' }, effects: [{ reveal: 'client_lance', journal: 'The Ninth Lance is Lucan Vane’s own company.' }] },
          { id: 'fire', text: 'Fire first.', if: { meter: 'fatigue', lte: 1 }, why: 'The company is in no shape to start a fight with the Ninth Lance.', battle: { strikes: 'D3+PL' }, effects: [{ meter: 'vane', add: -2 }, { flag: 'lance_burned' }, { reveal: 'client_lance', journal: 'The Ninth Lance is Lucan Vane’s own company.' }] }
        ], next: 'dx.battle' },
        { id: 'dx.battle', type: 'battle', scenario: 'meeting', map: 'dockring', tier: 'max', pl: 1, planet: 'industrial', enemy: rival('lance', { drop: ['kestrel_filmed', 'beat_lance'] }),
          on: { success: [{ effects: [{ meter: 'lance', add: -1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'lance', add: 1 }, { meter: 'stones', add: -1 }] }] }, next: 'dx.debrief' },
        { id: 'dx.debrief', type: 'debrief', text: '{if skip}Daw takes the log.{/if}{if not skip}The Lance pulls back.{/if}', events: ['dx.terms'], next: 'dx.interlude' },
        { id: 'dx.terms', type: 'event', who: 'vane', if: { not: { flag: 'log_handed' } }, title: 'Vane’s terms', text: 'His lawyer calls before the smoke clears.', options: [
          { id: 'pay', text: 'Pay him for the log.', cost: { kUC: 4 }, why: 'You can’t pay him.', effects: [{ meter: 'vane', set: 0 }, { flag: 'vane_cut_off', set: false }, { flag: 'vane_suspects' }] },
          { id: 'tell', text: 'Tell him where to put it.', effects: [{ flag: 'vane_cut_off' }] },
          { id: 'offer', text: 'Offer him the next lodestone.', effects: [{ flag: 'vane_suspects' }, { meter: 'vane', add: -1 }, { flag: 'owed_vane' }] }
        ] },
        interlude('dx.interlude', 'fault')
      ] },

      /* the interludes' events, and the hired guns', shared by every chapter */
      { id: 'shared', shared: true, title: 'Between chapters', nodes: [
        { id: 'i.wake', type: 'event', if: { wiped: { gte: 1 } }, title: 'The wake', text: 'The company buries its own.', options: [
          { id: 'pay', text: 'Pay the death benefits.', cost: { kUC: 1 }, why: 'You can’t pay them.', effects: [{ meter: 'fatigue', add: -1 }] },
          { id: 'dont', text: 'Don’t.', effects: [{ meter: 'fatigue', add: 1 }] }
        ] },
        // the company pushed too hard: they want a rest, and say so
        { id: 'i.tired', type: 'event', if: { meter: 'fatigue', gte: 3 }, title: 'Tired', text: 'The company is tired, and says so.', options: [
          { id: 'rest', text: 'Put in somewhere quiet for a week.', effects: [{ meter: 'fatigue', add: -2 }, { meter: 'lead', add: -1 }] },
          { id: 'bonus', text: 'Pay them a bonus.', cost: { kUC: 2 }, why: 'You can’t afford it.', effects: [{ meter: 'fatigue', add: -1 }] },
          { id: 'push', text: 'Push on.', effects: [{ meter: 'fatigue', add: 1 }, { roll: { d6: 4 }, fail: [{ leave: 1 }] }] }
        ] },
        { id: 'i.sendahead', type: 'event', once: true, who: 'client', if: { all: [{ not: { flag: 'vane_cut_off' } }, { meter: 'stones', gte: 2 }, { any: [{ meter: 'vane', gte: 1 }, { flag: 'owed_vane' }] }] },
          title: 'Send one ahead', text: 'Halloran’s backer wants a lodestone sent to him now.', options: [
          { id: 'send', text: 'Send it.', effects: [{ meter: 'stones', add: -1 }, { meter: 'vane', add: 1 }, { flag: 'owed_vane', set: false }, breaks()] },
          { id: 'refuse', text: 'Refuse.', effects: [{ meter: 'vane', add: -1 }, { if: { flag: 'owed_vane' }, flag: 'vane_cut_off' }, { if: { flag: 'vane_suspects' }, flag: 'vane_cut_off' }, { flag: 'vane_suspects' }] }
        ] },
        { id: 'i.voices', type: 'event', once: true, if: { meter: 'understanding', gte: 2 }, title: 'Voices', text: '{soldier:veteran} has started hearing them.', options: [
          { id: 'listen', text: 'Listen with them.', effects: [{ meter: 'understanding', add: 1 }, { meter: 'fatigue', add: 1 }] },
          { id: 'home', text: 'Send them home.', effects: [{ leave: 1 }, { meter: 'fatigue', add: -1 }, { meter: 'understanding', add: -1 }] }
        ] },
        { id: 'i.warm', type: 'event', once: true, if: { meter: 'stones', gte: 3 }, title: 'A warm stone', text: 'The lodestones are warm, and pointing the same way.', options: [
          { id: 'follow', text: 'Follow them.', effects: [{ meter: 'lead', add: 1 }, { meter: 'alarm', add: 1 }] },
          { id: 'shield', text: 'Shield them.', cost: { kUC: 1 }, why: 'You can’t afford it.', effects: [{ meter: 'alarm', add: -1 }] }
        ] },
        { id: 'i.newsfeed', type: 'event', once: true, who: 'rook', if: { all: [{ chapter: { gte: 2 } }, { not: { flag: 'kestrel_deal' } }] }, title: 'The newsfeed', text: 'A newsfeed wants pictures.', options: [
          { id: 'sell', text: 'Sell them.', effects: [{ kUC: 2 }, { flag: 'kestrel_deal' }, { meter: 'lead', add: -1 }, { reveal: 'client_kestrel', journal: 'Kestrel Air Cavalry flies for the Meridian newsfeed, which wants the first pictures of whatever is at the end. The Meridian changed hands last year, to a buyer on Halcyon.' }] },
          { id: 'refuse', text: 'Refuse.', effects: [{ meter: 'lead', add: 1 }, { reveal: 'client_kestrel', journal: 'Kestrel Air Cavalry flies for the Meridian newsfeed, which wants the first pictures of whatever is at the end. The Meridian changed hands last year, to a buyer on Halcyon.' }] }
        ] },
        { id: 'i.catalogue', type: 'event', once: true, who: 'kettering', if: { all: [{ flag: 'kettle_contact' }, { not: { flag: 'kettle_burned' } }] }, title: 'Brass Ledger’s catalogue', text: 'They are selling what they know.', options: [
          /* (what it is worth depends on who has the log: without it Brass Ledger are guessing, and some of it
             is true; with it, they are selling pages copied out of it. Page one, who pays them, either way) */
          { id: 'buy', text: 'Buy it anyway.', hidden: true, if: { not: { flag: 'ledger_has_log' } }, cost: { kUC: 2 }, why: 'You can’t afford it.', effects: [{ meter: 'kettle_trust', add: 1 }, { reveal: 'client_kettle', journal: 'Brass Ledger’s client this time: the Orrin Mercantile Bank of Kerrigan, behind three shell companies. Next time it will be whoever pays.' },
            { roll: { d6: 4 }, pass: [{ meter: 'intel', add: 1, journal: 'Some of Brass Ledger’s catalogue checks out: where the other companies are, and who they work for.' }], fail: [{ journal: 'Brass Ledger’s catalogue is mostly guesswork. Nothing in it checks out.' }] }] },
          { id: 'pages', text: 'Buy the pages they copied from the log.', hidden: true, if: { flag: 'ledger_has_log' }, cost: { kUC: 2 }, why: 'You can’t afford it.', effects: [{ meter: 'intel', add: 1 }, { meter: 'lead', add: 1 }, { meter: 'kettle_trust', add: 1 }, { reveal: 'client_kettle', journal: 'Brass Ledger’s client this time: the Orrin Mercantile Bank of Kerrigan, behind three shell companies. Next time it will be whoever pays.' }] },
          { id: 'sell', text: 'Sell them yours.', effects: [{ kUC: 2 }, { meter: 'lead', add: -1 }, { meter: 'vane', add: -1 }] },
          { id: 'ignore', text: 'Ignore it.' }
        ] },
        { id: 'i.jump', type: 'event', title: 'The jump', text: 'The drive is failing.', options: [
          { id: 'yard', text: 'Pay for the yard.', cost: { kUC: 1 }, why: 'You can’t afford it.', effects: [{ meter: 'fatigue', add: -1 }] },
          { id: 'jump', text: 'Jump anyway.', effects: [{ roll: { d6: 2 }, fail: [{ meter: 'lead', add: -1 }, { meter: 'fatigue', add: 1 }] }] }
        ] },
        // the hired guns, after a battle they fought in
        { id: 'hired.invoice', type: 'event', who: 'kettering', if: { flag: 'kettle_hired' }, title: 'The invoice', text: 'Brass Ledger want more than was agreed.', options: [
          { id: 'pay', text: 'Pay the extra.', cost: { kUC: 2 }, why: 'You can’t pay it.', effects: [{ meter: 'kettle_trust', add: 1 }, { flag: 'kettle_hired', set: false }] },
          { id: 'dispute', text: 'Dispute it.', effects: [{ meter: 'kettle_trust', add: -2 }, { meter: 'kettle_price', add: 1 }, { flag: 'kettle_hired', set: false }] },
          { id: 'share', text: 'Offer them a share of the claim instead.', effects: [{ meter: 'kettle_trust', add: 2 }, { flag: 'kettle_partner' }, { flag: 'kettle_hired', set: false }] }
        ] },
        { id: 'hired.edit', type: 'event', who: 'rook', if: { flag: 'kestrel_hired' }, title: 'The edit', text: 'Kestrel wants to cut the footage their way.', options: [
          { id: 'theirs', text: 'Let them.', effects: [{ meter: 'vane', add: -1 }, { meter: 'kestrel_trust', add: 1 }, { flag: 'kestrel_hired', set: false }] },
          { id: 'raw', text: 'Demand the raw footage.', effects: [{ meter: 'kestrel_trust', add: -1 }, { meter: 'intel', add: 1 }, { flag: 'kestrel_hired', set: false }] },
          { id: 'interview', text: 'Give them an interview.', effects: [{ meter: 'lead', add: -1 }, { meter: 'kestrel_trust', add: 2 }, { flag: 'kestrel_filmed' }, { flag: 'kestrel_hired', set: false }] }
        ] },
        { id: 'hired.mess', type: 'event', who: 'hal', if: { flag: 'reavers_hired' }, title: 'The mess', text: 'The Reavers have left a mess.', options: [
          { id: 'pay', text: 'Pay them off and walk away.', cost: { kUC: 1 }, why: 'You can’t pay them.', effects: [{ meter: 'reavers_trust', add: 1 }, { flag: 'reavers_hired', set: false }] },
          { id: 'clean', text: 'Make them clean it up.', effects: [{ meter: 'reavers_trust', add: -2 }, { meter: 'fatigue', add: -1 }, { flag: 'reavers_hired', set: false }] },
          { id: 'look', text: 'Look the other way.', effects: [{ meter: 'reavers_trust', add: 1 }, { meter: 'fatigue', add: 1 }, { meter: 'alarm', add: 1 }, { flag: 'reavers_hired', set: false }] }
        ] },
        { id: 'hired.favour', type: 'event', who: 'agathe', if: { flag: 'sable_hired' }, title: 'Favour returned', text: 'Sable has paid what it owed.', options: [
          { id: 'thank', text: 'Thank them.', effects: [{ meter: 'sable_trust', add: 1 }, { meter: 'sable_price', set: 2 }, { flag: 'sable_owed', set: false }, { flag: 'sable_hired', set: false }] },
          { id: 'again', text: 'Ask for another.', effects: [{ meter: 'sable_trust', add: -1 }, { meter: 'sable_price', set: 3 }, { flag: 'sable_hired', set: false }] }
        ] },
        { id: 'hired.kettleoffer', type: 'event', who: 'kettering', if: { all: [{ flag: 'kettle_worked' }, { meter: 'kettle_trust', lte: -2 }, { not: { flag: 'kettle_turned' } }] }, title: 'A better offer', text: 'Brass Ledger have been offered more.', options: [
          { id: 'match', text: 'Match it.', cost: { kUC: 'kettle_price' }, why: 'You can’t match it.', effects: [{ meter: 'kettle_trust', set: 0 }] },
          { id: 'let', text: 'Let them go.', effects: [{ flag: 'kettle_turned' }, { meter: 'kettle', add: 1 }] }
        ] },
        { id: 'hired.reaversoffer', type: 'event', who: 'hal', if: { all: [{ flag: 'reavers_worked' }, { meter: 'reavers_trust', lte: -2 }, { not: { flag: 'reavers_turned' } }] }, title: 'Hal’s other friends', text: 'The Reavers have had a better offer.', options: [
          { id: 'match', text: 'Match it.', cost: { kUC: 'reavers_price' }, why: 'You can’t match it.', effects: [{ meter: 'reavers_trust', set: 0 }] },
          { id: 'let', text: 'Let them go.', effects: [{ flag: 'reavers_turned' }, { meter: 'reavers', add: 1 }] }
        ] }
      ] },

      /* ================= the second half: The Long Jump ================= */
      // (the log never lost for good: still Brass Ledger's at the half, Halloran rebuilds it from the stones, which have begun to point)
      { id: 'fault', half: 2, counts: false, title: 'The Long Jump', onStart: rebuilt('the lodestones themselves, which have begun to point the way'), intro: 'Halloran reads the last pages of the log, and Morrow names them at last: Xenotripods, the three-legged ones, who step out of the air. Every newsfeed in the sector has the word by the next jump. From here the company chooses where to go, and what it leaves behind goes on without it.', nodes: [
        { id: 'fault.brief', type: 'brief', text: 'The trail splits.{if vane_cut_off} Vane has stopped paying.{/if}', next: 'pool' },
        { id: 'pool', type: 'pool', picks: 3, then: 'end' }
      ] },

      // the Race
      poolChapter({ id: 'claim', thread: 'race', title: 'Claim Jumpers', when: { meter: 'theirs', gte: 2 }, passed: [{ meter: 'kestrel', add: 1 }, { meter: 'lead', add: -1 }],
        place: { system: 'Corvin', planet: 'the Hollin Shelf', kind: 'mountain', world: { gravity: 'low' } },
        brief: 'Kestrel’s dropships are already down.',
        before: { id: 'claim.scoop', who: 'rook', title: 'The scoop', text: 'Kestrel got there first.', options: [
          { id: 'race', text: 'Race them in.', battle: { role: 'attacker', readiness: -1 } },
          { id: 'pictures', text: 'Offer them the pictures.', battle: { intel: 1 }, effects: [{ flag: 'kestrel_deal' }, { meter: 'lead', add: -1 }] },
          // hired, Kestrel's cars are the company's to get across, and the Reavers are the ones jumping the claim
          Object.assign(hireOption('kestrel', 'Ride shotgun for Kestrel, for a share.'), { battle: { allies: HIRE.kestrel, scenario: 'convoy', enemy: rival('reavers') },
            effects: hireOption('kestrel').effects.concat([{ flag: 'claim_escort', local: true }]) })
        ] },
        battle: { scenario: 'intercept', map: 'hollin', planet: 'mountain', variant: { cars: 'Kestrel ground car' }, enemy: rival('kestrel', { drop: ['beat_kestrel'] }),
          on: {
            success: [{ if: { flag: 'claim_escort' }, effects: [{ meter: 'stones', add: 1 }, { meter: 'kestrel_trust', add: 1 }, { meter: 'reavers', add: -1 }, { meter: 'lead', add: 1 }] },
              { effects: [{ meter: 'theirs', add: -1 }, { meter: 'stones', add: 1 }, { meter: 'kestrel', add: -1 }, { meter: 'lead', add: 2 }] }],
            failure: [{ if: { flag: 'claim_escort' }, effects: [{ meter: 'theirs', add: 1 }, { meter: 'reavers', add: 1 }] },
              { effects: [{ meter: 'theirs', add: 1 }] }] } },
        after: { id: 'claim.footage', who: 'rook', if: { not: { flag: 'claim_escort' } }, title: 'The footage', text: 'Kestrel filmed all of it.', options: [
          { id: 'run', text: 'Let them run it.', effects: [{ meter: 'vane', add: -1 }, { flag: 'kestrel_filmed' }] },
          { id: 'buy', text: 'Buy it from them.', cost: { kUC: 2 }, why: 'You can’t afford it.', effects: [{ meter: 'kestrel_trust', add: 1 }] }
        ] } }),
      poolChapter({ id: 'wreck', thread: 'race', title: 'The Wreck of the Morrow', when: { any: [{ flag: 'sable_owed' }, { meter: 'sable', gte: 3 }, { meter: 'stones', gte: 2 }] },
        passed: [{ meter: 'sable', add: 1 }],
        place: { system: 'Pell', planet: 'Pell', kind: 'unstable', world: { atmosphere: 'toxic' } },
        brief: 'Morrow’s ship, where it came down, and Sable cutting in.',
        before: { id: 'wreck.hatch', who: 'agathe', title: 'The hatch', text: 'Sable is already cutting in.', options: [
          { id: 'cut', text: 'Cut a second way in.', battle: { strikes: 'D3', role: 'attacker' }, effects: [{ meter: 'alarm', add: 1 }] },
          { id: 'wait', text: 'Wait for Sable to open it.', battle: { readiness: -1, edge: 'choose' }, effects: [{ meter: 'lead', add: -1 }] },
          // in with Sable, the ship is cleared of the salvage crew that beat everyone to it
          Object.assign(hireOption('sable', 'Call in what Sable owes you.'), { battle: { allies: HIRE.sable, enemy: rival('kettle') },
            effects: hireOption('sable').effects.concat([{ flag: 'wreck_together', local: true }]) })
        ] },
        battle: { scenario: 'ce_clear', planet: 'unstable', enemy: rival('sable'),
          on: {
            success: [{ if: { flag: 'wreck_together' }, effects: [{ meter: 'kettle', add: -1 }, { meter: 'sable_trust', add: 1 }, { meter: 'theirs', add: -1 }, { meter: 'lead', add: 1 }] },
              { effects: [{ meter: 'sable', add: -1 }, { meter: 'theirs', add: -1 }, { meter: 'lead', add: 1 }] }],
            failure: [{ if: { flag: 'wreck_together' }, effects: [{ meter: 'theirs', add: 1 }, { meter: 'kettle', add: 1 }] },
              { effects: [{ meter: 'theirs', add: 1 }] }] } },
        after: { id: 'wreck.morrow', if: { grade: 'success' }, title: 'Morrow', text: 'His body, his last entry, and a lodestone in his fist.', options: [
          { id: 'take', text: 'Take it.', effects: [{ meter: 'stones', add: 1 }, { flag: 'morrow_found' }] },
          { id: 'bury', text: 'Bury him with it.', effects: [{ meter: 'understanding', add: 1 }, { meter: 'fatigue', add: -1 }, { flag: 'relics_returned' }] }
        ] } }),
      poolChapter({ id: 'bounty', thread: 'race', fallback: true, title: 'Bounty', passed: [{ meter: 'wraith', add: 1 }],
        place: { system: 'Ilya', planet: 'Ilya', kind: 'sparse' },
        brief: 'Wraith Section has been paid to stop the company.',
        before: { id: 'bounty.tip', who: 'nine', title: 'The tip', text: 'Wraith is coming.', options: [
          { id: 'trap', text: 'Lay a trap for the trap.', cost: { intel: 1 }, why: 'You’d need Intel to spend.', battle: { variant: { ambush: 'player' } } },
          { id: 'run', text: 'Run.', battle: { readiness: 0, role: 'defender' }, effects: [{ meter: 'lead', add: -1 }] },
          { id: 'deal', text: 'Nine offers to call it off, for a lodestone.', if: { all: [{ any: [{ flag: 'wraith_warned' }, { flag: 'wraith_orders' }] }, { meter: 'stones', gte: 1 }] },
            why: 'Nine has no reason to talk to you.', battle: { skip: true }, effects: [{ meter: 'stones', add: -1 }, { meter: 'theirs', add: 1 }] },
          hireOption('reavers', 'Hire the Reavers to hunt the hunters.')
        ] },
        battle: { scenario: 'meeting', map: 'ilya', planet: 'sparse', enemy: rival('wraith', { changes: [{ if: { flag: 'wraith_robbed' }, readiness: 1 }] }),
          on: { success: [{ effects: [{ meter: 'wraith', add: -1 }, { meter: 'stones', add: 1 }, { meter: 'theirs', add: -1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'stones', add: -1 }, { meter: 'theirs', add: 1 }] }] } },
        after: { id: 'bounty.paymaster', if: { grade: 'success' }, title: 'The paymaster', text: 'The bounty hunters’ paymaster, taken.', options: [
          { id: 'hand', text: 'Hand them in.', if: { not: { flag: 'vane_cut_off' } }, why: 'Vane has cut you off.', effects: [{ meter: 'vane', add: 1 }] },
          { id: 'turn', text: 'Turn them.', effects: [{ meter: 'intel', add: 2 }, { flag: 'wraith_turned' }] }
        ] } }),
      poolChapter({ id: 'landing', thread: 'race', finale: true, rival: 'leading', title: 'The Landing', place: Object.assign({ site: 'the landing field' }, QUIET),
        brief: 'The leading rival holds the only landing field on the Quiet.',
        before: { id: 'landing.field', title: 'The field', text: 'They are dug in.', options: [
          { id: 'alone', text: 'Go in alone.', battle: { role: 'attacker' } },
          // (never the company holding the field)
          Object.assign(hireOption('kettle', 'Hire Brass Ledger for the landing.'), { if: { all: [HIRE_IF.kettle, { not: { leading: 'kettle' } }] }, why: 'Brass Ledger won’t fight for you here.' }),
          Object.assign(hireOption('reavers', 'Hire the Reavers for the landing.'), { if: { all: [HIRE_IF.reavers, { not: { leading: 'reavers' } }] }, why: 'The Reavers won’t fight for you here.' })
        ] },
        // the leading rival, whoever it is, its commander the target; the more lodestones it holds, the readier it is
        battle: { scenario: 'takeover', map: 'quietfield', role: 'attacker', tier: 'max', pl: 'max', planet: 'dense', variant: { target: 'leading' },
          enemy: { rival: 'leading', changes: [{ if: { meter: 'theirs', gte: 4 }, readiness: 1 }] },
          adjust: [
            { if: { all: [{ flag: 'kettle_partner' }, { not: { leading: 'kettle' } }] }, levers: { allies: HIRE.kettle } },
            { if: { all: [{ flag: 'contact' }, ESHAVEN_WITH_YOU] }, levers: { allies: ESHAVEN_ALLIES } },
            { if: { flag: 'wraith_turned' }, levers: { intel: 2 } },
            { if: { any: [{ flag: 'kettle_turned' }, { flag: 'reavers_turned' }] }, levers: { readiness: 1 } },
            { if: { meter: 'stones', lt: 5 }, levers: { readiness: 1 } }
          ],
          on: { success: FINALE_ON.success, failure: [{ effects: [{ flag: 'landing_lost' }] }] } } }),

      // the Tribes
      poolChapter({ id: 'watchers', thread: 'tribes', title: 'The Watchers', when: { meter: 'alarm', gte: 2 }, passed: [{ meter: 'alarm', add: 1 }],
        place: { system: 'Brannock', planet: 'Brannock VI', kind: 'mountain', world: { atmosphere: 'foggy' } },
        brief: 'The Ulvar’s domes cover the only pass.',
        before: { id: 'watchers.wall', title: 'The shieldwall', text: 'The domes cover the pass.', options: [
          { id: 'strike', text: 'Strike the shield turrets.', battle: { scenario: 'strike', name: 'The Shieldwall' } },
          { id: 'round', text: 'Go round.', battle: { skip: true }, effects: [{ meter: 'lead', add: -2 }, { meter: 'alarm', add: 1 }] },
          { id: 'under', text: 'Go under it, the way the Mithdu showed you.', if: { flag: 'mithdu_marked' }, why: 'Nobody has shown you a way under.', battle: { tier: 'max-1', role: 'choose' } }
        ] },
        battle: { scenario: 'strike', map: 'brannock', planet: 'mountain', enemy: tribe('ulvar'),
          on: { success: [{ effects: [{ meter: 'stones', add: 1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'alarm', add: 2 }] }] } },
        after: { id: 'watchers.dome', if: { grade: 'success' }, title: 'The dome falls', text: 'Its keepers ask for their dead.', options: [
          { id: 'give', text: 'Give them back.', effects: [{ meter: 'understanding', add: 1 }, { meter: 'alarm', add: -1 }] },
          { id: 'cores', text: 'Keep the turret cores.', effects: [{ kUC: 3 }, { meter: 'alarm', add: 2 }, { meter: 'vane', add: 1 }, breaks()] }
        ] } }),
      poolChapter({ id: 'storm', thread: 'tribes', title: 'Teleport Storm', when: { any: [{ flag: 'beacon_stormed' }, { flag: 'alpha_taken' }, { meter: 'alarm', gte: 4 }] },
        passed: [{ meter: 'alarm', add: 1 }],
        place: { system: 'Sedra', planet: 'Sedra II', kind: 'sparse', world: { anomaly: 'time' } },
        brief: 'The Sh’kar step out of the air around the camp.',
        before: { id: 'storm.air', title: 'The air goes wrong', text: 'The camp’s sensors scream.', options: [
          { id: 'dig', text: 'Dig in.', battle: { role: 'defender', turns: 6 } },
          { id: 'move', text: 'Move the stones away from the camp.', battle: { readiness: -1, suppressOwn: 'D3' }, effects: [{ meter: 'lead', add: -1 }] }
        ] },
        battle: { scenario: 'invasion', map: 'sedra', role: 'defender', planet: 'sparse', enemy: tribe('shkar', { changes: [{ if: { flag: 'beacon_stormed' }, readiness: 1 }] }),
          on: { success: [{ effects: [{ meter: 'alarm', add: -1 }] }], failure: [{ effects: [{ meter: 'stones', add: -1 }, { meter: 'alarm', add: 1 }] }] } },
        after: { id: 'storm.what', if: { meter: 'stones', gte: 1 }, title: 'What they came for', text: 'They came for the lodestones.', options: [
          { id: 'return', text: 'Return one.', if: { meter: 'stones', gte: 1 }, why: 'You have none to return.', effects: [{ meter: 'stones', add: -1 }, { meter: 'alarm', add: -2 }, { flag: 'relics_returned' }] },
          { id: 'keep', text: 'Keep them all.', effects: [{ meter: 'alarm', add: 1 }] }
        ] } }),
      poolChapter({ id: 'cold', thread: 'tribes', fallback: true, title: 'Cold Sites', passed: [{ meter: 'alarm', add: 1 }],
        place: { system: 'Kasimir', planet: 'Kasimir', kind: 'desert', world: { anomaly: 'weakness' } },
        brief: 'The Mithdu under the sand.',
        before: { id: 'cold.sand', title: 'The sand moves', text: 'The ruins are not empty.', options: [
          { id: 'clear', text: 'Clear the ruins.', battle: { tier: 'max', suppressOwn: 1 } },
          { id: 'seal', text: 'Seal them.', battle: { skip: true }, effects: [{ meter: 'alarm', add: 1 }, { meter: 'lead', add: 1 }] }
        ] },
        battle: { scenario: 'ce_clear', planet: 'desert', enemy: tribe('mithdu'),
          on: { success: [{ effects: [{ meter: 'stones', add: 1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'alarm', add: 1 }] }] } },
        after: { id: 'cold.child', if: { grade: 'success' }, title: 'A Mithdu child', text: 'It hasn’t run.', options: [
          { id: 'let', text: 'Let it go.', effects: [{ meter: 'understanding', add: 1 }] },
          { id: 'vane', text: 'Take it to Vane.', if: { not: { flag: 'vane_cut_off' } }, why: 'Vane has cut you off.', effects: [{ meter: 'vane', add: 2 }, { meter: 'alarm', add: 2 }, { flag: 'child_taken' }, breaks()] }
        ] } }),
      poolChapter({ id: 'spire', thread: 'tribes', finale: true, title: 'The Spire', place: Object.assign({ site: 'an Amt spire' }, QUIET),
        brief: 'Into the towers of the Amt.',
        before: { id: 'spire.door', title: 'The door', text: 'The spire is sealed.', options: [
          { id: 'force', text: 'Burn the way in.', battle: { strikes: 'D3+PL', readiness: 1 } },
          { id: 'eshaven', text: 'Let the Esh-Aven open it.', if: { all: [{ flag: 'eshaven_promise' }, ESHAVEN_WITH_YOU] }, why: 'Nobody here will open it for you.',
            battle: { allies: ESHAVEN_ALLIES, readiness: -1 } },
          { id: 'quiet', text: 'Go in quietly.', battle: { readiness: 0, role: 'choose' } }
        ] },
        battle: { scenario: 'hive_heart', tier: 'max', pl: 'max', planet: 'dense', waves: { meter: 'alarm', base: 1, per: 3 },
          enemy: tribe('amt', { changes: [{ if: { flag: 'hoard_taken' }, readiness: 2 }, { if: { flag: 'child_taken' }, readiness: 2 }, { if: { flag: 'alpha_taken' }, readiness: 1 }] }),
          adjust: [{ if: { all: [{ flag: 'contact' }, ESHAVEN_WITH_YOU] }, levers: { allies: ESHAVEN_ALLIES } }, { if: { meter: 'stones', lt: 5 }, levers: { readiness: 1 } }],
          on: { success: FINALE_ON.success, failure: [{ effects: [{ flag: 'spire_lost' }] }] } } }),

      // First Contact: allies, no finale of its own
      poolChapter({ id: 'mimics', thread: 'contact', title: 'The Mimics', when: { all: [{ any: [{ meter: 'understanding', gte: 1 }, { flag: 'eshaven_graves' }, { flag: 'thule_records' }] }, { not: { flag: 'kettle_partner' } }] }, passed: [{ meter: 'understanding', add: -1 }, { meter: 'kettle', add: 1 }],
        place: { system: 'Hashamer', planet: 'Hashamer I', kind: 'desert' },
        brief: 'Nine million Esh-Aven, and not a Crock among them.',
        before: { id: 'mimics.ask', who: 'seven', title: 'A village asks', text: 'Brass Ledger are taking Esh-Aven for a buyer.', options: [
          { id: 'help', text: 'Fight beside them.', battle: { allies: ESHAVEN_ALLIES } },
          { id: 'pay', text: 'Pay Brass Ledger to leave.', if: HIRE_IF.kettle, why: 'Brass Ledger won’t deal with you.', cost: { kUC: 'kettle_price' },
            battle: { skip: true }, effects: [{ meter: 'understanding', add: 1 }] }
        ] },
        battle: { scenario: 'meeting', map: 'hashamer', planet: 'desert', enemy: rival('kettle'),
          on: { success: [{ effects: [{ meter: 'kettle', add: -1 }, { meter: 'understanding', add: 1 }, { meter: 'stones', add: 1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'understanding', add: -1 }] }] } },
        after: { id: 'mimics.thanks', who: 'seven', title: 'The Esh-Aven’s thanks', text: 'A guide who remembers the road to the Quiet, and a price.', options: [
          { id: 'promise', text: 'Make the promise.', effects: [{ flag: 'eshaven_freed' }, { flag: 'eshaven_promise' }, { meter: 'understanding', add: 2 }, { meter: 'lead', add: 1 }] },
          { id: 'guide', text: 'Take the guide, and promise nothing.', effects: [{ flag: 'eshaven_freed' }, { meter: 'understanding', add: 1 }] },
          { id: 'stone', text: 'Ask for a lodestone instead.', effects: [{ meter: 'stones', add: 1 }, { meter: 'understanding', add: -1 }] }
        ] } }),
      poolChapter({ id: 'speaker', thread: 'contact', title: 'The Speaker', when: { any: [{ meter: 'understanding', gte: 3 }, { flag: 'beacon_rubbing' }] }, passed: [{ meter: 'understanding', add: -1 }],
        place: { system: 'Orlo', planet: 'Orlo', kind: 'sparse' },
        brief: 'An Alpha waits on the far shore of a lake.',
        before: { id: 'speaker.pylon', title: 'The pylon', text: 'It is waiting for the company.', options: [
          { id: 'meet', text: 'Meet it.', battle: { scenario: 'parley', name: 'The Speaker' } },
          { id: 'vane', text: 'Bring Vane’s people.', if: { not: { flag: 'vane_cut_off' } }, why: 'Vane has cut you off.', battle: { scenario: 'parley', readiness: 1 }, effects: [{ meter: 'vane', add: 2 }] }
        ] },
        battle: { scenario: 'parley', map: 'orlo', planet: 'sparse', enemy: tribe('amt', { changes: [
          { if: { flag: 'beacon_rubbing' }, readiness: -1 }, { if: { flag: 'eshaven_promise' }, readiness: -1 },
          { if: { flag: 'alpha_taken' }, readiness: 1 }, { if: { flag: 'promise_broken' }, readiness: 1 }, { if: { flag: 'wraith_orders' }, readiness: -1 }] }),
          on: { success: [{ effects: [{ flag: 'contact' }, { meter: 'alarm', add: -2 }, { meter: 'stones', add: 1 }] }], failure: [{ effects: [{ meter: 'alarm', add: 2 }] }] } } }),
      poolChapter({ id: 'signal', thread: 'contact', fallback: true, title: 'Signal Fires',
        place: { system: 'Tessaly', planet: 'Tessaly IV', kind: 'jungle', world: { atmosphere: 'foggy' } },
        brief: 'Back at the beacon, to light it.',
        battle: { scenario: 'holdline', map: 'beaconlit', planet: 'jungle', waves: { meter: 'understanding', base: 1, per: 3 }, enemy: tribe('shkar'),
          on: { success: [{ effects: [{ meter: 'understanding', add: 2 }] }], failure: [{ effects: [{ meter: 'alarm', add: 1 }] }] } } }),

      // the Patron
      poolChapter({ id: 'vault', thread: 'patron', title: 'The Vault', when: { any: [{ flag: 'vane_suspects' }, { meter: 'vane', lte: 0 }, { flag: 'vane_cut_off' }] },
        passed: [{ meter: 'vane', add: -1 }, { meter: 'lance', add: 1 }],
        place: { system: 'Halcyon', planet: 'Halcyon', kind: 'dense' },
        brief: 'Vane’s store of relics.',
        before: { id: 'vault.door', who: 'vane', title: 'Vane’s vault', text: 'His relics, and receipts for what he has sold.', options: [
          { id: 'night', text: 'Break in by night.', battle: { scenario: 'strike', tier: 'max-1' } },
          { id: 'ask', text: 'Ask to see it.', if: { not: { flag: 'vane_cut_off' } }, why: 'Vane won’t see you.', effects: [{ roll: { d6: 4, meter: 'vane' },
            pass: [{ flag: 'vault_seen' }, { next: { battle: 'vault.battle', levers: { skip: true } } }], fail: [{ meter: 'vane', add: -1 }] }] }
        ] },
        battle: { scenario: 'ce_control', planet: 'dense', enemy: rival('lance'),
          on: { success: [{ effects: [{ meter: 'lance', add: -1 }, { meter: 'stones', add: 1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'lance', add: 1 }] }] } },
        after: { id: 'vault.receipts', title: 'The receipts', text: 'Vane has been selling stones to the rivals all along.', options: [
          { id: 'publish', text: 'Publish them.', effects: [{ flag: 'vane_exposed' }, { meter: 'vane', add: -5 }, { flag: 'vane_cut_off' }] },
          { id: 'use', text: 'Use them.', effects: [{ flag: 'vane_owes' }, { meter: 'vane', add: 1 }] }
        ] } }),
      poolChapter({ id: 'escort', thread: 'patron', title: 'The Escort', when: { all: [{ meter: 'stones', gte: 1 }, { not: { flag: 'vane_cut_off' } }] }, passed: [{ meter: 'vane', add: -1 }],
        place: { system: 'Umber', planet: 'Umber', kind: 'industrial', world: { atmosphere: 'toxic' } },
        brief: 'Vane’s relics, across a contested world.',
        before: { id: 'escort.road', title: 'The convoy', text: 'Two roads to the field.', options: [
          { id: 'fast', text: 'The fast road.', battle: { role: 'attacker', tier: 'max' } },
          { id: 'long', text: 'The long road.', battle: { readiness: 0, turns: 8 }, effects: [{ meter: 'lead', add: -1 }, { meter: 'fatigue', add: -1 }] }
        ] },
        // (the Navy's warrant: Wraith Section impounds what comes off the trail; the Lance is Vane's, and never against his cargo)
        battle: { scenario: 'convoy', map: 'umber', variant: { cars: 'Relic truck' }, planet: 'industrial', enemy: rival('wraith'),
          on: { success: [{ effects: [{ meter: 'wraith', add: -1 }] }], failure: [{ effects: [{ meter: 'vane', add: -1 }, { meter: 'wraith', add: 1 }] }] } },
        after: { id: 'escort.cargo', if: { grade: 'success' }, title: 'The cargo', text: 'Vane’s relics, safe.', options: [
          { id: 'deliver', text: 'Deliver it.', effects: [{ meter: 'vane', add: 2 }] },
          { id: 'keep', text: 'Keep a stone.', effects: [{ meter: 'stones', add: 1 }, { meter: 'vane', add: -2 }] }
        ] } }),
      poolChapter({ id: 'debts', thread: 'patron', fallback: true, title: 'Debts', passed: [{ meter: 'lance', add: 1 }],
        place: { system: 'Tarn', planet: 'Tarn', kind: 'industrial' },
        brief: 'The bailiffs find the company.',
        before: { id: 'debts.bailiffs', who: 'daw', title: 'The bailiffs', text: 'The Ninth Lance, with paperwork.', options: [
          { id: 'pay', text: 'Pay them.', cost: { kUC: 3 }, why: 'You can’t pay them.', battle: { skip: true, turns: 0 } },
          { id: 'fight', text: 'Fight them.', battle: { role: 'choose', readiness: 1 } }
        ] },
        battle: { scenario: 'meeting', map: 'tarn', planet: 'industrial', enemy: rival('lance'),
          on: { success: [{ effects: [{ meter: 'lance', add: -1 }] }], skip: [{}], failure: [{ effects: [{ meter: 'lance', add: 1 }] }] } } }),
      poolChapter({ id: 'collector', thread: 'patron', finale: true, title: 'The Collector', place: Object.assign({ site: 'the landing field' }, QUIET),
        brief: 'Vane comes in person, with the Ninth Lance.',
        before: { id: 'collector.vane', who: 'vane', title: 'Vane comes in person', text: 'For the first time, Vane is in the room. He has terms.', options: [
          { id: 'terms', text: 'Hear his terms.', if: { flag: 'vane_owes' }, why: 'He owes you nothing.', battle: { scenario: 'parley', name: 'Last Terms' } },
          { id: 'fight', text: 'Shoot the flag down.', battle: { role: 'attacker' }, effects: [{ meter: 'fatigue', add: -1 }] },
          hireOption('reavers', 'Hire the Reavers against him.')
        ] },
        battle: { scenario: 'takeover', map: 'quietfield', role: 'attacker', tier: 'max', pl: 'max', planet: 'dense', variant: { target: 'Commander Daw' },
          enemy: rival('lance', { changes: [{ if: { flag: 'lance_burned' }, readiness: 1 }] }),
          adjust: [
            { if: { all: [{ flag: 'contact' }, ESHAVEN_WITH_YOU] }, levers: { allies: ESHAVEN_ALLIES } },
            { if: { flag: 'vault_seen' }, levers: { intel: 2 } },
            { if: { meter: 'stones', lt: 5 }, levers: { readiness: 1 } }
          ],
          on: { success: FINALE_ON.success, failure: [{ effects: [{ flag: 'collector_lost' }] }] } } }),

      // the override: the Quiet wakes
      { id: 'recall', half: 2, title: 'Recall', onStart: [{ flag: 'recalled' }], place: Object.assign({ site: 'the landing field' }, QUIET),
        intro: 'Every teleport turret on the Quiet opens at once.', nodes: [
        { id: 'recall.brief', type: 'brief', text: 'The towers wake.', next: 'recall.run' },
        { id: 'recall.run', type: 'event', title: 'Run', text: 'The field, and the last way off.', options: [
          { id: 'stones', text: 'Run with the stones.', if: { meter: 'stones', gte: 1 }, why: 'You have no stones to carry.', battle: { turns: 6 } },
          { id: 'leave', text: 'Run, and leave the stones.', battle: { turns: 8, readiness: -1 }, effects: [{ meter: 'alarm', add: -3 }, { meter: 'stones', set: 0 }] }
        ], next: 'recall.battle' },
        { id: 'recall.battle', type: 'battle', scenario: 'breakout', map: 'quietfog', tier: 'max', pl: 'max', planet: 'dense', waves: { meter: 'alarm', base: 1, per: 3 }, enemy: tribe('amt'),
          adjust: [{ if: { all: [{ flag: 'eshaven_promise' }, ESHAVEN_WITH_YOU] }, levers: { allies: ESHAVEN_ALLIES } }],
          on: { success: FINALE_ON.success, failure: [{}] }, next: 'recall.debrief' },
        { id: 'recall.debrief', type: 'debrief', text: 'The company is off the Quiet, with what it could carry.', events: [], next: 'end' }
      ] },

      { id: 'end', half: 2, counts: false, title: 'The end', nodes: [{ id: 'end.node', type: 'ending' }] }
    ],

    endings: [
      { id: 'broken', broken: true, title: 'Broken Company', text: 'There is not enough of {name} left to field an army.' },
      { id: 'lostsignal', title: 'Lost Signal', if: { any: [{ flag: 'recalled' }, { all: [{ flag: 'spire_lost' }, { meter: 'alarm', gte: 5 }] }] }, text: 'The Quiet woke, and {name} got off it with what it could carry. Nobody will find the way again.' },
      { id: 'claimjumped', title: 'Claim Jumped', if: { any: [{ flag: 'landing_lost' }, { all: [{ not: { flag: 'finale_won' } }, { meter: 'theirs', gte: 4 }, { more: ['theirs', 'stones'] }] }] }, text: 'Another company’s name is on the claim.' },
      { id: 'repossessed', title: 'Repossessed', if: { flag: 'collector_lost' }, text: 'Vane has the Quiet, and {name} has nothing.' },
      { id: 'firstcontact', title: 'First Contact', if: { all: [{ any: [{ flag: 'contact' }, { all: [{ flag: 'relics_returned' }, { meter: 'understanding', gte: 3 }] }] }, { flag: 'finale_won' }, { meter: 'alarm', lt: 8 },
        { not: { flag: 'child_taken' } }, { not: { flag: 'promise_broken' } }] }, text: '{name} is the first company the Amt answer, and walks away with no salvage at all.' },
      { id: 'findersfee', title: 'Finder’s Fee', if: { all: [{ not: { flag: 'contact' } }, { not: { flag: 'vane_cut_off' } }, { not: { flag: 'vane_exposed' } }, { not: { played: 'collector' } }, { flag: 'finale_won' }, { meter: 'vane', gte: 1 }] },
        text: 'The claim is filed in Vane’s name.{if kettle_partner} Brass Ledger take their share.{/if} {name} is rich, and the Quiet will be stripped.' },
      { id: 'deadreckoning', title: 'Dead Reckoning', text: '{name} reached the end of the log, and what it did there decided nothing.' }
    ],

    epilogue: [
      { about: 'quiet', if: { flag: 'recalled' }, text: 'The Quiet is awake, and its tribes are coming home to it.' },
      { about: 'quiet', if: { flag: 'contact' }, text: 'The Amt sleep again, by their own choice, and send a word to {name} now and then.' },
      { about: 'quiet', text: 'The Quiet is on every chart now.' },
      { about: 'eshaven', if: { flag: 'promise_broken' }, text: 'The Hashamer remember the company that broke its word.' },
      { about: 'eshaven', if: { all: [{ flag: 'eshaven_promise' }, { flag: 'recalled' }] }, text: 'The Quiet called, and the Hashamer went to it, as they said they would. Their village stands empty.' },
      { about: 'eshaven', if: { flag: 'eshaven_promise' }, text: 'The Hashamer are still on their world, free, and they say the names of their dead.' },
      { about: 'vane', if: { flag: 'vane_exposed' }, text: 'Lucan Vane’s receipts are public, and so, at last, is his face.' },
      { about: 'vane', text: 'Lucan Vane has another lot in the catalogue, bought by telephone, from nowhere.' },
      { about: 'rivals', if: { flag: 'kettle_partner' }, text: 'Brass Ledger are partners in the claim, and remind everyone of it.' },
      { about: 'rivals', text: 'The rivals went back to the work they had before the log.' },
      { about: 'company', if: { meter: 'fatigue', lte: 3 }, text: '{name} came back with {commander}, fewer than it took, and every one of them signed on again.' },
      { about: 'company', if: { meter: 'fatigue', gte: 4 }, text: 'Half of {name} signed on somewhere else before the next contract. The ones who stayed with {commander} don’t talk about the trail.' }
    ]
  }))));

  if (typeof module !== 'undefined' && module.exports) module.exports = S.get('dead-reckoning');
})(typeof window !== 'undefined' ? window : global);
