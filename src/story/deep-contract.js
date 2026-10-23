/* PMC 2670 — Firefight : Deep Contract, the first story (docs/story-mode-plan.md)

   The story bible as data: every chapter, event, battle, thread and ending in
   the plan, each event's situation and options in a line, and the meters and
   flags each one moves. The prose is laid over it from deep-contract-text.js;
   the side contracts, the endings and the epilogue carry their own words here.

   The second half fights the story's own scenarios (src/story/scenarios-story.js:
   Hive Heart, Convoy, Breakout, Hold the Line, Strike, Parley), their waves
   as many as Hive Growth calls for (a battle's `waves`). Enemy forces name
   their troops; the battle hooks (levers.js) add the leader for the Battle
   Tier, scale the optional units by their meter and fill to fit the company. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');
  // the story's words, and its maps, kept in files of their own (deep-contract-text.js, deep-contract-maps.js)
  if (!(root.PMCStoryText && root.PMCStoryText['deep-contract']) && typeof require === 'function') require('./deep-contract-text.js');
  if (!(root.PMCStoryMaps && root.PMCStoryMaps['deep-contract']) && typeof require === 'function') require('./deep-contract-maps.js');
  var TEXT = (root.PMCStoryText && root.PMCStoryText['deep-contract']) || {};

  /* The words laid over the working: a chapter's intro, a node's text, an
     option's text and why it is closed, where the words file has them. */
  function withProse(def) {
    (def.chapters || []).forEach(function (ch) {
      if (TEXT[ch.id]) ch.intro = TEXT[ch.id];
      (ch.nodes || []).forEach(function (n) {
        if (TEXT[n.id]) n.text = TEXT[n.id];
        if (TEXT[n.id + '#name']) n.name = TEXT[n.id + '#name'];       // a battle's mission name
        (n.options || []).forEach(function (o) {
          if (TEXT[n.id + '/' + o.id]) o.text = TEXT[n.id + '/' + o.id];
          if (TEXT[n.id + '/' + o.id + '.why']) o.why = TEXT[n.id + '/' + o.id + '.why'];
        });
      });
    });
    return def;
  }

  /* ---------- who each event is about: their face beside it (view/story-portraits.js) ---------- */
  var WHO = {
    'c1.portmaster': 'okonkwo', 'c1.gate': 'htx', 'c2.firstmove': 'htx', 'c2r.nightshift': 'front', 'c2r.ledger': 'front',
    'c2r.survivors': 'htx', 'c2d.truck': 'petrak', 'c2d.armoury': 'front', 'c2d.rota': 'petrak', 'c3.killorcapture': 'htx',
    'c3.cell': 'varga', 'c3.martyr': 'varga', 'c3.door': 'htx', 'c4.school': 'teacher', 'c4.payroll': 'guild',
    'sump.map': 'front', 'sump.below': 'hive', 'relief.handover': 'lantern', 'relief.wounded': 'lantern',
    'retake.survivors': 'htx', 'retake.holdouts': 'front', 'revenge.challenge': 'front', 'revenge.chance': 'varga',
    'splinter.informant': 'front', 'splinter.bomber': 'front', 'redoubt.approach': 'front', 'ceasefire.terms': 'varga',
    'ceasefire.peace': 'htx', 'holdline.gap': 'front', 'holdline.dead': 'front', 'outbreak.miners': 'guild',
    'outbreak.samples': 'hive', 'shafts.charges': 'hive', 'shafts.collapse': 'htx', 'hiveheart.descent': 'hive',
    'partner.orders': 'lantern', 'partner.prisoners': 'lantern', 'leak.uplink': 'htx', 'leak.publish': 'htx',
    'convoy.route': 'lantern', 'convoy.cargo': 'htx', 'showdown.terms': 'lantern', 'breakout.order': 'htx',
    'i.audit': 'htx', 'i.offer': 'lantern', 'i.tunnels': 'hive', 'i.word': 'guild', 'h1.core': 'htx'
  };
  function withWho(def) {
    (def.chapters || []).forEach(function (ch) { (ch.nodes || []).forEach(function (n) { if (WHO[n.id]) n.who = WHO[n.id]; }); });
    return def;
  }

  /* ---------- the forces ---------- */
  /* A side's usual force, with what a battle writes laid over it: its own
     changes come after the side's usual ones, not in place of them. */
  function over(base, extra) {
    var out = Object.assign({}, base, extra || {});
    if (extra && extra.changes) out.changes = (base.changes || []).concat(extra.changes);
    return out;
  }
  function front(extra) {
    return over({
      side: 'front', faction: 'rebel', tactics: 'guerillas',
      core: ['rminers', 'rmilitia', 'rmilitia'],
      optional: { meter: 'rebels', per: 2, units: ['rmilitia', 'rtechnical', 'rlightart', 'rinsurgents', 'rat'] },
      fill: { to: 0.8, from: ['rmilitia', 'rtechnical', 'rminers', 'rinsurgents'], meter: 'rebels', step: 0.05 },
      byTier: { 1: ['rciv', 'rridergang', 'rdesconscript'], 3: ['rfaceminers', 'rinsurgents', 'rhardened'] },
      changes: [
        { if: { flag: 'varga_dead' }, add: { key: 'rfanatics', name: 'The Avengers', rules: ['Determined'] } },
        { if: { meter: 'sentiment', lte: -3 }, readiness: 1 }
      ]
    }, extra);
  }
  function hive(extra) {
    return over({
      side: 'hive', faction: 'bugs',
      core: ['bsmall', 'btiny', 'bspitlarva'],
      optional: { meter: 'hive', per: 1, units: ['bsmall', 'battack', 'bunderground', 'bspitters', 'boversized', 'bhugeunder'] },
      fill: { to: 0.9, from: ['btiny', 'bsmall', 'battack'], meter: 'hive', step: 0.05 }
    }, extra);
  }
  function lantern(extra) {
    return over({
      side: 'lantern', faction: 'pmc',
      core: ['regular', 'regular', 'lmgteam', { key: 'veterans', name: 'Lantern Actual', honours: [3] }],
      optional: { meter: 'lantern', per: 2, units: ['lapc', 'sharpshooters', 'atteam', 'lcv', 'gunboat'] },
      fill: { to: 1.0, from: ['regular', 'rookie', 'lmgsection'], meter: 'lantern', step: 0.05 },
      changes: [
        { if: { flag: 'lantern_crossed' }, honour: { unit: 'Lantern Actual', rules: ['Determined'] } },
        { if: { flag: 'htx_tracking' }, readiness: 1 }
      ]
    }, extra);
  }

  /* ---------- the interludes: one event each, the first that fits ---------- */
  var INTERLUDE = ['i.wake', 'i.standdown', 'i.audit', 'i.offer', 'i.tunnels', 'i.word'];
  function interlude(id, next, text) {
    return { id: id, type: 'interlude', text: text || 'The company rests, refits and counts the cost.', events: INTERLUDE, next: next };
  }

  /* ---------- a second-half chapter: brief, event, battle, debrief, interlude ---------- */
  function poolChapter(o) {
    var id = o.id, nodes = [{ id: id + '.brief', type: 'brief', text: o.brief, next: o.before ? o.before.id : id + '.battle' }];
    if (o.before) nodes.push(Object.assign({ type: 'event', next: id + '.battle' }, o.before));
    nodes.push(Object.assign({ id: id + '.battle', type: 'battle', tier: 'max', pl: 1, next: id + '.debrief' }, o.battle));
    nodes.push({ id: id + '.debrief', type: 'debrief', text: o.debrief || 'The fighting is over.', events: o.after ? [o.after.id] : [], next: o.finale ? 'end' : id + '.interlude' });
    if (o.after) nodes.push(Object.assign({ type: 'event' }, o.after));
    if (!o.finale) nodes.push(interlude(id + '.interlude', 'pool'));
    return { id: id, half: 2, thread: o.thread, title: o.title, when: o.when, fallback: !!o.fallback, finale: !!o.finale, passed: o.passed, onStart: o.onStart, nodes: nodes };
  }

  // a side contract's cost in time: in the second half, the hive grows while you are away
  var LATE_TIME = { if: { chapter: { gte: 5 } }, meter: 'hive', add: 1 };

  var FINALE_ON = {
    success: [{ effects: [{ flag: 'finale_won' }] }],
    failure: [{ effects: [{ flag: 'finale_lost' }] }]
  };

  S.register(withWho(withProse({
    id: 'deep-contract', name: 'Deep Contract', version: 1, length: 8,
    blurb: 'Kessler\'s Reach is a mining moon, and its miners have risen. HTX hires your company to restore order, quickly and quietly. HTX is hiding why they rose.',
    // the locals talk: with their trust, you know what you face before a battle
    /* What the company knows of the enemy before a battle (story.js `intel`):
       word of them, an outline, or the full list. The Intel meter's network,
       the locals' goodwill, an informant inside the Front, and knowing what
       lives in the Sump each add a level; a battle's own `intel` lever (a
       scout's report, a bribe, a guide) adds the rest. */
    intel: [
      { if: { meter: 'intel', gte: 3 }, add: 1 },
      { if: { meter: 'intel', gte: 6 }, add: 1 },
      { if: { meter: 'sentiment', gte: 3 }, add: 1 },
      { if: { flag: 'informant' }, add: 1, side: 'front' },
      { if: { flag: 'hive_known' }, add: 1, side: 'hive' }
    ],
    // what the journal says the flags mean, as prose (a flag is never shown as a flag)
    flagText: {
      refinery_lost: 'The Front holds the refinery.', depot_raided: 'The Front\'s depot went up.',
      varga_dead: 'Ada Varga is dead.', varga_held: 'Varga is in your hands.', varga_handed: 'Varga is in an HTX cell.',
      varga_free: 'Varga is free.', varga_released: 'You let Varga go.', varga_talked: 'Varga told you why the miners rose.',
      core_recovered: 'You have the Deep Contract\'s data core.', coverup: 'You are hiding the data core from HTX.',
      sump_entered: 'You have been down in the Sump.', hive_known: 'The miners know about the hive.',
      htx_cut_off: 'HTX has cut you off.', htx_suspects: 'HTX suspects you.', truce: 'There is a truce with the Front.',
      leaked: 'The world knows what HTX did.', pit9_shelled: 'You shelled Pit Nine.', pit9_spared: 'Pit Nine was spared.',
      miners_sealed: 'You sealed the miners in.', sample_taken: 'HTX has a live sample of the hive.',
      lantern_mercy: 'Black Lantern owes you for its wounded.', lantern_crossed: 'Black Lantern will not forget the prisoners.'
    },
    start: { faction: 'pmc', found: 'standard' },

    /* HTX's bonus for a story battle won (story.js bonusFor): the battle's `pay`,
       else 2 kUC, a quarter more or less for each point of HTX Standing; half for
       a draw; nothing once HTX has stopped paying. */
    pay: { base: 2, meter: 'htx', step: 0.25, draw: 0.5, cutOff: ['htx_cut_off'] },

    /* The difficulty, chosen when the story begins (story.js difficultyOf): the
       enemy's share of each battle's points (`fill`), what the company's own
       experience adds to it (`allowance`, multiplied), and the pay (HTX's bonus
       and the side contracts, multiplied). Contract is the story as tuned. */
    difficulty: {
      story: { name: 'Story', blurb: 'Lighter enemy forces, slower to grow with you, and better pay. For following the story.', fill: -0.15, allowance: 0.5, pay: 1.5 },
      contract: { name: 'Contract', default: true, blurb: 'The story as it is tuned: an even fight for a company that keeps up.', fill: 0, allowance: 1, pay: 1 },
      hard: { name: 'Hard', blurb: 'Stronger enemy forces that grow faster with you, and less money.', fill: 0.15, allowance: 1.5, pay: 0.75 }
    },

    /* Side contracts (story.js makeOffers): small jobs offered at an interlude,
       one taken at most, each a battle of its own and paid in kUC. Taking one
       costs time (Hive Growth +1) unless it was offered to catch the company
       up with the curve (the Company Tier wanted by each chapter); behind it,
       or cut off from HTX, there are two on offer, and cut off they pay half
       as much again. Passing one up can cost something too. */
    side: {
      offers: { base: 1, behind: 2, cutOff: 2 }, cutOffPay: 1.5, cutOff: ['htx_cut_off'],
      curve: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3 },
      jobs: [
        { id: 'orerun', title: 'The Ore Run', pay: 3, if: { not: { flag: 'htx_cut_off' } },
          text: 'HTX wants an escort for an ore train down the haul road. The Front has been hitting the trains at the cuttings, and the drivers have stopped volunteering.',
          scenario: 'meeting', map: 'haulroad', tier: 'max-1', enemy: front({ fill: { to: 0.7, from: ['rmilitia', 'rtechnical', 'rminers'] } }),
          cost: [LATE_TIME], passed: [{ meter: 'htx', add: -1 }],
          on: { success: [{ effects: [{ meter: 'htx', add: 1 }] }], failure: [{ effects: [{ meter: 'rebels', add: 1 }] }] } },
        { id: 'bounty', title: 'Bounty on the Ridges', pay: 3, if: { all: [{ not: { flag: 'htx_cut_off' } }, { meter: 'rebels', gte: 2 }] },
          text: 'A Front raiding party has been shooting up the survey camps on the slag ridges. HTX has put a price on it, payable on proof.',
          scenario: 'meeting', map: 'ridges', tier: 'max-1', enemy: front({ fill: { to: 0.7, from: ['rmilitia', 'rminers', 'rinsurgents'] } }),
          cost: [LATE_TIME],
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{}] } },
        { id: 'salvage', title: 'Salvage Rights', pay: 4,
          text: 'A lifter came down in the old ore yards with its hold full. Whoever reaches it first owns what is in it, and the scavengers are already on their way.',
          scenario: 'find', map: 'oreyards', tier: 'max-1', enemy: front({ tactics: 'guerillas', fill: { to: 0.7, from: ['rciv', 'rmilitia', 'rminers'] } }),
          cost: [LATE_TIME], on: { success: [{}], failure: [{}] } },
        { id: 'pithead', title: 'The Guild\u2019s Pithead', pay: 3, if: { any: [{ flag: 'sump_entered' }, { flag: 'hive_known' }, { chapter: { gte: 5 } }] },
          text: 'The miners\u2019 guild will pay you to hold a pithead for a night. Something has been coming up the shafts, and the guild\u2019s own men will not go near it.',
          scenario: 'secure', map: 'pumping', tier: 'max-1', enemy: hive({ fill: { to: 0.7, from: ['btiny', 'bsmall'] } }),
          cost: [LATE_TIME, { meter: 'htx', add: -1 }], passed: [{ meter: 'sentiment', add: -1 }],
          on: { success: [{ effects: [{ meter: 'sentiment', add: 1 }, { meter: 'hive', add: -1 }] }], failure: [{ effects: [{ meter: 'sentiment', add: -1 }] }] } },
        { id: 'nest', title: 'The Nest by the Road', pay: 3, if: { any: [{ meter: 'hive', gte: 3 }, { chapter: { gte: 6 } }] },
          text: 'Bugs have nested in a pump house by the haul road. Burn it out before it spreads.',
          scenario: 'ce_clear', tier: 'max-1', enemy: hive({ fill: { to: 0.7, from: ['btiny', 'bsmall', 'battack'] } }),
          cost: [LATE_TIME],
          on: { success: [{ effects: [{ meter: 'hive', add: -1 }] }], failure: [{ effects: [{ meter: 'hive', add: 1 }] }] } },
        { id: 'refugees', title: 'The Refugee Column', pay: 2, if: { all: [{ meter: 'sentiment', gte: 1 }, { chapter: { gte: 3 } }] },
          text: 'A column of miners\u2019 families is walking out of the Pits, and there are guns between them and the coast. They can pay a little. They are asking anyway.',
          scenario: 'meeting', map: 'hills', tier: 'max-1', enemy: front({ fill: { to: 0.6, from: ['rciv', 'rmilitia'] } }),
          cost: [LATE_TIME], passed: [{ meter: 'sentiment', add: -1 }],
          on: { success: [{ effects: [{ meter: 'sentiment', add: 2 }] }], failure: [{ effects: [{ meter: 'sentiment', add: -1 }] }] } },
        { id: 'frontmoney', title: 'Front Money', pay: 4, if: { flag: 'htx_cut_off' },
          text: 'With HTX gone quiet, the Front\u2019s money spends as well as anyone\u2019s. They want a Black Lantern post on the hill road taken off the map.',
          scenario: 'demolish', map: 'hills', tier: 'max-1', role: 'attacker', enemy: lantern({ core: ['regular', 'regular', 'lmgteam'], fill: { to: 0.7, from: ['regular', 'rookie'] } }),
          cost: [LATE_TIME],
          on: { success: [{ effects: [{ meter: 'lantern', add: -1 }, { meter: 'sentiment', add: 1 }] }], failure: [{ effects: [{ meter: 'lantern', add: 1 }] }] } }
      ]
    },
    meters: {
      htx: { start: 1, shown: true, name: 'HTX Standing', uses: ['pay', 'strikes', 'supply'], thresholds: [{ gte: 2 }, { lte: -3 }] },
      sentiment: { start: 0, name: 'Sentiment', uses: ['intel', 'readiness'], thresholds: [{ gte: 3 }, { lte: -2 }, { lte: -3 }] },
      loyalty: { start: 1, shown: true, name: 'Loyalty', uses: ['reroll', 'suppression'], thresholds: [{ gte: 2 }, { lte: 0 }, { lte: -2 }] },
      intel: { start: 1, min: 0, max: 6, shown: true, name: 'Intel', uses: ['reveal', 'intel'], thresholds: [{ gte: 3 }, { gte: 4 }, { gte: 6 }] },
      rebels: { start: 5, min: 0, max: 10, name: 'Rebel Strength', uses: ['force'], thresholds: [{ lte: 0 }, { gte: 7 }] },
      hive: { start: 0, min: 0, max: 10, name: 'Hive Growth', uses: ['force', 'tunnel'], twoWay: [2], thresholds: [{ gte: 3 }, { gte: 5 }, { gte: 8 }] },
      lantern: { start: 2, min: 0, max: 10, name: 'Black Lantern Strength', uses: ['force'], thresholds: [{ gte: 4 }, { gte: 7 }] }
    },
    /* The people and sides the story's events are about, each with the face
       drawn for them beside their events (view/story-portraits.js). */
    people: {
      varga: { name: 'Ada Varga', role: 'The Free Miners\u2019 Front', face: { bg: '#d9733f', skin: '#c48a64', hair: '#2b2622', hairStyle: 'long', hat: 'helmet', hatColour: '#c8a040', clothes: '#6e3b2a', clothesStyle: 'jacket', accent: '#e0b070', extras: ['scar'] } },
      front: { name: 'The Free Miners\u2019 Front', role: 'The miners in arms', face: { bg: '#c45f34', skin: '#a8754f', hair: '#3a2a20', hat: 'beanie', hatColour: '#4f5f3a', clothes: '#5a4a3a', extras: ['bandana'], bandana: '#b03a2e' } },
      okonkwo: { name: 'Port Master Okonkwo', role: 'Kessler\u2019s Reach starport', face: { bg: '#8fb3c9', skin: '#6b4630', hair: '#1d1612', hairStyle: 'short', hat: 'cap', hatColour: '#2f3e5a', clothes: '#2f3e5a', clothesStyle: 'uniform', accent: '#e8c25a', extras: ['moustache'] } },
      petrak: { name: 'Petrak', role: 'Driver, Truck Fourteen', face: { bg: '#b9a77a', skin: '#e2b48f', hair: '#7a5a3a', hat: 'beanie', hatColour: '#3a6a7a', clothes: '#6a6a5a', extras: ['stubble'], eyes: '#4a6a8a' } },
      htx: { name: 'HTX', role: 'Halvorsen-Tey Extraction Consortium', face: { bg: '#6fc4e2', skin: '#e8c0a0', hair: '#bdbdbd', hairStyle: 'short', clothes: '#22262e', clothesStyle: 'suit', accent: '#3a8fb0', extras: ['glasses'], eyes: '#5a7a9a' } },
      lantern: { name: 'Black Lantern', role: 'Black Lantern Security', face: { bg: '#e0c25a', skin: '#c99a76', hair: '#222', hairStyle: 'bald', hat: 'visor', hatColour: '#2c2c32', clothes: '#34343c', clothesStyle: 'armour', accent: '#e0c25a' } },
      teacher: { name: 'The teacher', role: 'Pit Nine school', face: { bg: '#a8c98a', skin: '#d8a07a', hair: '#4a2a1a', hairStyle: 'bun', clothes: '#7a6a8a', clothesStyle: 'cardigan', accent: '#e8c25a', extras: ['glasses', 'earring'], lips: '#b0505a' } },
      guild: { name: 'The miners\u2019 guild', role: 'Pit Nine and the shafts', face: { bg: '#c9b68f', skin: '#b07a55', hair: '#5a4030', hat: 'hardhat', hatColour: '#e0a020', clothes: '#4a5a6a', clothesStyle: 'overalls', accent: '#c87a2a', extras: ['beard'] } },
      hive: { name: 'The hive', role: 'Below Kessler\u2019s Reach', face: { bug: true, bg: '#2a1a34', shell: '#5a3d6e', glow: '#e46cff' } }
    },
    sides: {
      front: { faction: 'rebel', name: "Free Miners' Front" },
      hive: { faction: 'bugs', name: 'The Sump Hive' },
      lantern: { faction: 'pmc', name: 'Black Lantern Security' }
    },

    /* What time does at each chapter's start. */
    everyChapter: [
      { if: { chapter: { gte: 6 } }, meter: 'hive', add: 1 },
      { if: { meter: 'sentiment', lte: -2 }, meter: 'rebels', add: 1 },
      { if: { all: [{ chapter: { gte: 5 } }, { any: [{ flag: 'htx_suspects' }, { flag: 'htx_cut_off' }] }] }, meter: 'lantern', add: 1 },
      { if: { meter: 'intel', gte: 4 }, reveal: 'rebels' },
      { if: { meter: 'intel', gte: 6 }, reveal: 'lantern' }
    ],
    everyBattle: [
      { if: { grade: 'decisive' }, meter: 'htx', add: 1 },
      // winning keeps the company together
      { if: { grade: 'success' }, meter: 'loyalty', add: 1 }
    ],

    threads: {
      front: { name: 'The Front', pressure: [{ meter: 'rebels', w: 1 }, { flag: 'varga_free', w: 2 }, { flag: 'varga_dead', w: 2 }, { flag: 'refinery_lost', w: 2 }, { meter: 'sentiment', w: -0.5 }] },
      truce: { name: 'The truce', finale: false, pressure: [{ flag: 'varga_talked', w: 3 }, { flag: 'varga_released', w: 3 }, { flag: 'varga_spared', w: 3 }, { flag: 'hive_known', w: 2 }, { flag: 'ledger_sold', w: 1 }, { meter: 'sentiment', w: 1 }] },
      hive: { name: 'The hive', pressure: [{ meter: 'hive', w: 1 }, { flag: 'sump_entered', w: 3 }, { flag: 'pit9_shelled', w: 1 }] },
      htx: { name: 'HTX and Black Lantern', pressure: [{ meter: 'htx', w: -1 }, { meter: 'lantern', w: 0.5 }, { flag: 'core_recovered', w: 2 }, { flag: 'htx_suspects', w: 2 }, { flag: 'htx_cut_off', w: 3 }, { flag: 'coverup', w: 1 }, { flag: 'core_sold', w: -2 }] }
    },
    picks: 3,
    finaleOverride: [
      { if: { any: [{ meter: 'hive', gte: 8 }, { all: [{ flag: 'sample_taken' }, { meter: 'hive', gte: 7 }] }] }, chapter: 'breakout' }
    ],

    chapters: [
      /* ================= the first half: The Contract ================= */
      { id: 'c1', half: 1, title: 'Landfall', intro: 'HTX hires the company to restore order on Kessler\'s Reach.', nodes: [
        { id: 'c1.brief', type: 'brief', text: 'Secure the starport against a Front strike.', next: 'c1.portmaster' },
        { id: 'c1.portmaster', type: 'event', title: "The port master's offer", text: 'The port\'s security chief offers his men, if HTX pays them.', options: [
          { id: 'take', text: 'Take them.', battle: { allies: { side: 'port', faction: 'pmc', core: ['enforcers', 'enforcers'] } }, effects: [{ kUC: -1 }] },
          { id: 'send', text: 'Send them home.' },
          { id: 'ask', text: 'Ask what they know, and not nicely.', battle: { intel: 1 }, effects: [{ meter: 'sentiment', add: -1 }] }
        ], next: 'c1.battle' },
        { id: 'c1.battle', type: 'battle', map: 'starport', scenario: 'secure', tier: 1, pl: 1, planet: 'industrial',
          // the first battle, lighter than most: the Front's strike on the port, not its army
          enemy: front({ core: ['rminers', 'rmilitia'], optional: { meter: 'rebels', per: 3, units: ['rmilitia', 'rtechnical'] },
            fill: { to: 0.6, from: ['rmilitia', 'rminers'], meter: 'rebels', step: 0.05 } }),
          on: {
            success: [{ next: 'c1.debrief' }],
            // it cannot be lost outright: the port is held, at a cost
            failure: [{ effects: [{ meter: 'loyalty', add: -1 }, { journal: 'The port is held, at a cost.' }], next: 'c1.debrief' }]
          } },
        { id: 'c1.debrief', type: 'debrief', text: 'The port is quiet.', events: ['c1.gate'], next: 'c1.interlude' },
        { id: 'c1.gate', type: 'event', title: 'The dead at the gate', text: 'Rebel dead, and civilians among them.', options: [
          { id: 'bury', text: 'Bury them openly.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'htx', add: -1 }] },
          { id: 'process', text: 'Let HTX "process" them.', effects: [{ meter: 'htx', add: 1 }, { flag: 'gate_cleared' }] }
        ] },
        interlude('c1.interlude', 'c2')
      ] },

      { id: 'c2', half: 1, title: 'First Move', nodes: [
        { id: 'c2.brief', type: 'brief', text: 'Two jobs, and only time for one.', next: 'c2.firstmove' },
        { id: 'c2.firstmove', type: 'event', title: 'First move', text: 'The refinery is besieged. The Front\'s supply depot is open to a raid.', options: [
          /* (an option's `passed` is what comes of its job when the other is taken) */
          { id: 'relieve', text: 'Relieve the refinery.', effects: [{ flag: 'job_refinery', local: true }],
            // the refinery without you: the garrison holds on a 4+, +1 with HTX behind it
            passed: [{ roll: { d6: 4, mods: [{ if: { meter: 'htx', gte: 2 }, add: 1 }] },
              pass: [{ journal: 'The garrison held the refinery without you.' }],
              fail: [{ flag: 'refinery_lost' }, { meter: 'rebels', add: 1 }, { next: { battle: 'c3.battle', enemy: { add: 'rtechnical' } } }] }] },
          { id: 'strike', text: 'Raid the depot.',
            // the depot left alone: the Front keeps its guns for the hunt
            passed: [{ meter: 'rebels', add: 1 }, { next: { battle: 'c3.battle', enemy: { add: 'rlightart' } } }] }
        ], next: 'c2.which' },
        { id: 'c2.which', type: 'branch', when: [{ if: { flag: 'job_refinery' }, next: 'c2r.nightshift' }, { next: 'c2d.truck' }] },

        { id: 'c2r.nightshift', type: 'event', title: 'The night shift', text: 'Refinery workers are still inside, and the Front has offered them safe passage out.', options: [
          { id: 'free', text: 'Let them go.', battle: { readiness: 1 }, effects: [{ meter: 'sentiment', add: 1 }, { flag: 'nightshift_freed' }] },
          { id: 'shield', text: 'Keep them as a human shield.', battle: { edge: 'choose' }, effects: [{ meter: 'sentiment', add: -2 }, { meter: 'loyalty', add: -1 }] },
          { id: 'sabotage', text: 'Get them to sabotage the Front\'s guns.', cost: { intel: 1 }, why: 'You don\'t know enough about the guns.',
            effects: [{ roll: { d6: 4, meter: 'intel' }, pass: [{ next: { battle: 'c2r.battle', levers: { strikes: 'D3' } } }], fail: [{ flag: 'nightshift_shot' }] }] }
        ], next: 'c2r.battle' },
        { id: 'c2r.battle', type: 'battle', map: 'refinery', scenario: 'invasion', role: 'defender', tier: 'max', pl: 1, planet: 'industrial',
          enemy: front({ tactics: 'wave' }),
          on: {
            success: [{ next: 'c2r.debrief' }],
            failure: [{ effects: [{ flag: 'refinery_lost' }, { meter: 'rebels', add: 1 }], next: 'c2r.debrief' }]
          } },
        { id: 'c2r.debrief', type: 'debrief', text: 'The refinery\'s fires burn down.', events: ['c2r.ledger', 'c2r.survivors'], next: 'c2.interlude' },
        { id: 'c2r.ledger', type: 'event', if: { grade: 'success' }, title: 'The ledger', text: 'A quartermaster\'s ledger shows where the Front gets its money.', options: [
          { id: 'give', text: 'Give it to HTX.', effects: [{ meter: 'htx', add: 1 }, { meter: 'rebels', add: -2 }] },
          { id: 'read', text: 'Read it first.', effects: [{ meter: 'intel', add: 2 }, { flag: 'ledger_read' }] },
          { id: 'sell', text: 'Sell it back to the Front.', extreme: true, effects: [{ kUC: 2 }, { meter: 'sentiment', add: 1 }, { meter: 'htx', add: -1 }, { flag: 'ledger_sold' }] }
        ] },
        { id: 'c2r.survivors', type: 'event', if: { grade: 'failure' }, title: 'The survivors', text: 'HTX blames you for the refinery.', options: [
          { id: 'blame', text: 'Take the blame.', effects: [{ meter: 'htx', add: -1 }, { meter: 'loyalty', add: 1 }] },
          { id: 'garrison', text: 'Blame the garrison.', effects: [{ meter: 'loyalty', add: -1 }, { flag: 'garrison_blamed' }] }
        ] },

        { id: 'c2d.truck', type: 'event', title: 'Truck 14', text: 'A driver will sell you the depot\'s guard rota.', options: [
          { id: 'pay', text: 'Pay him.', cost: { kUC: 1 }, why: 'You can\'t pay him.', battle: { intel: 2 } },
          { id: 'grab', text: 'Grab him and question him.', battle: { intel: 1 }, effects: [{ meter: 'intel', add: 1 }, { meter: 'loyalty', add: -1 }, { flag: 'driver_taken' }] },
          { id: 'blind', text: 'Go in blind, now, before the rota changes.', battle: { role: 'attacker', readiness: 0 } },
          { id: 'night', text: 'A small team, by night.', battle: { tier: 'max-1' } }
        ], next: 'c2d.battle' },
        { id: 'c2d.battle', type: 'battle', map: 'oreyards', scenario: 'demolish', role: 'attacker', tier: 'max', pl: 1, planet: 'industrial',
          enemy: front({ tactics: 'laststand' }),
          on: {
            success: [{ effects: [{ flag: 'depot_raided' }], next: 'c2d.debrief' }],
            failure: [{ next: 'c2d.debrief' }]
          } },
        { id: 'c2d.debrief', type: 'debrief', text: 'The depot burns, or doesn\'t.', events: ['c2d.armoury', 'c2d.rota'], next: 'c2.interlude' },
        { id: 'c2d.armoury', type: 'event', if: { grade: 'success' }, title: 'The armoury', text: 'The Front\'s heavy weapons, more than you can carry.', options: [
          { id: 'blow', text: 'Blow it all.', effects: [{ meter: 'rebels', add: -2 }] },
          { id: 'take', text: 'Take the best of it.', effects: [{ upgrade: 'random' }, { meter: 'rebels', add: -1 }, { meter: 'htx', add: -1 }] },
          { id: 'leave', text: 'Leave it for HTX to collect.', effects: [{ meter: 'htx', add: 1 }, { meter: 'rebels', add: -1 }, { meter: 'intel', add: 1 }] }
        ] },
        { id: 'c2d.rota', type: 'event', if: { grade: 'failure' }, title: 'The rota changed', text: 'The Front knew you were coming. Someone talked.', options: [
          { id: 'hunt', text: 'Find the leak in your own ranks.', effects: [{ roll: { d6: 4, meter: 'intel' }, pass: [{ meter: 'loyalty', add: 1 }], fail: [{ meter: 'loyalty', add: -2 }] }] },
          { id: 'letgo', text: 'Let it go.', effects: [{ meter: 'rebels', add: 1 }] }
        ] },
        interlude('c2.interlude', 'c3')
      ] },

      { id: 'c3', half: 1, title: 'The Hunt', nodes: [
        { id: 'c3.brief', type: 'brief', text: 'Ada Varga has been found.{if depot_raided} Her guns went up with the depot.{/if}', next: 'c3.killorcapture' },
        { id: 'c3.killorcapture', type: 'event', title: 'Kill or capture', text: 'HTX wants Varga dead. {soldier:veteran} thinks she is worth more alive.', options: [
          { id: 'gunship', text: 'Call in the HTX gunship.', if: { all: [{ meter: 'htx', gte: 1 }, { flag: 'depot_raided' }] }, why: 'Not with the Front\'s guns still up, and not without HTX behind you.',
            battle: { strikes: 'D3+PL' }, effects: [{ meter: 'htx', add: 1 }] },
          { id: 'snatch', text: 'Send the snatch team. Take her alive.',
            battle: { variant: { target: "Varga's Own", capture: true }, tier: 'max-1' }, effects: [{ flag: 'aim_capture', local: true }] },
          { id: 'wait', text: 'Wait for her to move.', battle: { role: 'choose' }, effects: [{ meter: 'hive', add: 1 }] }
        ], next: 'c3.battle' },
        { id: 'c3.battle', type: 'battle', map: 'pumping', scenario: 'find', tier: 'max', pl: 1, planet: 'mountain',
          variant: { target: "Varga's Own" },
          enemy: front({ core: ['rminers', 'rmilitia', { key: 'rhardened', name: "Varga's Own", honours: [3] }],
            changes: [{ if: { flag: 'depot_raided' }, remove: 'rlightart' }, { if: { flag: 'driver_taken' }, remove: 'rtechnical' }] }),
          on: {
            // (a capture that ended with her dead is a kill: the target variant says which)
            success: [{ if: { all: [{ flag: 'aim_capture' }, { not: { target: 'killed' } }] }, effects: [{ flag: 'varga_captured' }] },
                      { effects: [{ flag: 'varga_dead' }, { meter: 'rebels', add: -2 }] }],
            failure: [{ effects: [{ meter: 'htx', add: -1 }, { flag: 'varga_free' }] }]
          }, next: 'c3.debrief' },
        { id: 'c3.debrief', type: 'debrief', text: 'The hunt is over.', events: ['c3.cell', 'c3.martyr', 'c3.door'], next: 'c3.end' },
        { id: 'c3.cell', type: 'event', if: { flag: 'varga_captured' }, title: 'The cell', text: 'Varga asks to talk to you, and only you.', options: [
          { id: 'listen', text: 'Listen.', effects: [{ meter: 'intel', add: 1 }, { flag: 'varga_talked' }, { flag: 'varga_held' }] },
          { id: 'hand', text: 'Hand her straight to HTX.', effects: [{ meter: 'htx', add: 2 }, { flag: 'varga_handed' }] },
          { id: 'hold', text: 'Hold her yourself, as leverage.', effects: [{ meter: 'htx', add: -1 }, { meter: 'rebels', add: -2 }, { flag: 'varga_held' }] },
          { id: 'release', text: 'Let her go.', extreme: true, effects: [{ meter: 'htx', add: -2 }, { meter: 'sentiment', add: 2 }, { flag: 'varga_released' }] }
        ] },
        { id: 'c3.martyr', type: 'event', if: { flag: 'varga_dead' }, title: 'The martyr', text: 'Her body is in your hands, and the whole moon knows it.', options: [
          { id: 'home', text: 'Send her home to the miners.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'rebels', add: 1 }] },
          { id: 'display', text: 'Let HTX put her on display.', effects: [{ meter: 'htx', add: 1 }, { meter: 'sentiment', add: -3 }, { meter: 'rebels', add: -1 }, { flag: 'martyr_displayed' }] },
          { id: 'bury', text: 'Bury her quietly where no one will find her.', effects: [{ meter: 'loyalty', add: -1 }] }
        ] },
        { id: 'c3.door', type: 'event', if: { grade: ['defeat', 'rout'] }, title: 'The sealed door', text: 'Varga\'s people weld the blast door behind them. HTX says the lower levels are off limits.', options: [
          { id: 'letgo', text: 'Let her go for now.', effects: [{ meter: 'loyalty', add: 1 }] },
          { id: 'follow', text: 'Blast the door and follow her down.', extreme: true, if: { meter: 'loyalty', gte: 0 }, why: 'The company won\'t follow you down there.',
            effects: [{ meter: 'hive', add: 1 }, { meter: 'htx', add: -1 }, { flag: 'sump_entered' }] }
        ] },
        // both one-offs triggered: the Sump wins, and HTX only suspects
        { id: 'c3.end', type: 'happening', effects: [
          { if: { all: [{ flag: 'sump_entered' }, { any: [{ flag: 'varga_released' }, { meter: 'htx', lte: -3 }, { all: [{ flag: 'ledger_sold' }, { meter: 'htx', lte: -1 }] }] }] }, flag: 'htx_suspects' }
        ], next: 'c3.route' },
        { id: 'c3.route', type: 'branch', when: [
          { if: { flag: 'sump_entered' }, next: 'sump' },
          { if: { any: [{ flag: 'varga_released' }, { meter: 'htx', lte: -3 }, { all: [{ flag: 'ledger_sold' }, { meter: 'htx', lte: -1 }] }] }, next: 'relief' },
          { next: 'c3.interlude' }
        ] },
        interlude('c3.interlude', 'c4')
      ] },

      { id: 'c4', half: 1, title: 'Pit Nine', nodes: [
        { id: 'c4.brief', type: 'brief', text: 'A mining town rises. HTX\'s site office is in it.', next: 'c4.school' },
        { id: 'c4.school', type: 'event', title: 'The schoolhouse', text: 'The Front has fortified the town school, with children still in it.', options: [
          { id: 'clear', text: 'Clear it room by room.', battle: { scenario: 'ce_control', name: 'Room by Room' }, effects: [{ flag: 'pit9_clearing', local: true }] },
          { id: 'shell', text: 'Shell it, then storm the town.', battle: { strikes: 'D6' },
            effects: [{ meter: 'sentiment', add: -4 }, { meter: 'hive', add: 1 }, { meter: 'loyalty', add: -1 }, { flag: 'pit9_shelled' }] },
          { id: 'talk', text: 'Talk to the teacher.', if: { any: [{ flag: 'nightshift_freed' }, { flag: 'varga_held' }] }, why: 'You\'d need the miners\' trust, or Varga.',
            effects: [{ roll: { d6: 4, meter: 'sentiment', mods: [{ if: { flag: 'gate_cleared' }, add: -1 }] },
              pass: [{ meter: 'sentiment', add: 2 }, { flag: 'pit9_spared' }, { next: { battle: 'c4.battle', levers: { skip: true } } }],
              fail: [{ next: { battle: 'c4.battle', levers: { scenario: 'meeting', variant: { ambush: true }, name: 'Ambush on the Square' } } }] }] }
        ], next: 'c4.battle' },
        { id: 'c4.battle', type: 'battle', map: 'pitnine', scenario: 'secure', tier: 'max', pl: 1, planet: 'industrial', enemy: front({ tactics: 'laststand' }),
          on: {
            success: [{ if: { flag: 'pit9_clearing' }, effects: [{ meter: 'sentiment', add: 2 }, { flag: 'pit9_spared' }] }, {}],
            failure: [{ effects: [{ meter: 'rebels', add: 1 }] }],
            skip: [{ effects: [{ journal: 'The teacher opens the doors. Nobody fires.' }] }]
          }, next: 'c4.debrief' },
        { id: 'c4.debrief', type: 'debrief', text: 'Pit Nine is yours, and HTX\'s site office with it.', events: ['c4.payroll', 'h1.core'], next: 'c4.interlude' },
        { id: 'c4.payroll', type: 'event', title: 'Payroll', text: 'The town\'s payroll safe survived the fight.', options: [
          { id: 'keep', text: 'Keep it.', effects: [{ kUC: 3 }, { meter: 'loyalty', add: 1 }, { meter: 'sentiment', add: -2 }] },
          { id: 'miners', text: 'Return it to the miners.', effects: [{ meter: 'sentiment', add: 2 }] },
          { id: 'htx', text: 'Return it to HTX.', effects: [{ meter: 'htx', add: 1 }] }
        ] },
        interlude('c4.interlude', 'fault')
      ] },

      /* ---------- the one-offs ---------- */
      { id: 'sump', half: 1, oneOff: true, title: 'Into the Sump', nodes: [
        { id: 'sump.brief', type: 'brief', text: 'Below the welded door, the old workings, and something else.', next: 'sump.map' },
        { id: 'sump.map', type: 'event', title: "The miners' map", text: 'A captured miner offers a route through the old workings.', options: [
          { id: 'trust', text: 'Trust him.', battle: { role: 'choose' },
            effects: [{ roll: { d6: 3 }, fail: [{ next: { battle: 'sump.battle', levers: { suppressOwn: 'D3' } } }] }] },
          { id: 'surveys', text: 'Use HTX\'s surveys.', effects: [{ flag: 'htx_tracking' }] },
          { id: 'blast', text: 'Blast a new way in.', battle: { strikes: 'D3' }, effects: [{ meter: 'hive', add: 2 }] }
        ], next: 'sump.battle' },
        { id: 'sump.battle', type: 'battle', scenario: 'ce_clear', tier: 'max', pl: 1, planet: 'unstable', enemy: hive(),
          on: { success: [{}], failure: [{ effects: [{ meter: 'hive', add: 1 }] }] }, next: 'sump.debrief' },
        { id: 'sump.debrief', type: 'debrief', text: 'The hive is real, and it is waking.', events: ['h1.core', 'sump.below'], next: 'sump.after' },
        { id: 'sump.below', type: 'event', title: "What's down there", text: 'The hive is real, and it is waking.', options: [
          { id: 'report', text: 'Report it to HTX.', effects: [{ meter: 'htx', add: 1 }, { flag: 'htx_tracking' }] },
          { id: 'miners', text: 'Tell the miners.', effects: [{ meter: 'sentiment', add: 2 }, { flag: 'hive_known' }] },
          { id: 'keep', text: 'Keep it to yourselves.', effects: [{ meter: 'intel', add: 1 }] }
        ] },
        { id: 'sump.after', type: 'happening', effects: [{ meter: 'hive', add: 3 }, { reveal: 'hive' }], next: 'sump.interlude' },
        interlude('sump.interlude', 'fault')
      ] },
      { id: 'relief', half: 1, oneOff: true, title: 'The Relief', nodes: [
        { id: 'relief.brief', type: 'brief', text: 'HTX sends Black Lantern to "relieve" you.', next: 'relief.handover' },
        { id: 'relief.handover', type: 'event', title: 'The handover', text: 'Black Lantern\'s commander arrives with a letter from HTX and a smile.', options: [
          { id: 'leave', text: 'Hand over the sector and leave.', battle: { skip: true } },
          { id: 'refuse', text: 'Refuse.', battle: { role: 'choose' } },
          { id: 'fire', text: 'Fire first.', battle: { strikes: 'D3', role: 'attacker' }, effects: [{ meter: 'sentiment', add: 1 }] }
        ], next: 'relief.battle' },
        { id: 'relief.battle', type: 'battle', map: 'starport', scenario: 'meeting', tier: 'max', pl: 1, planet: 'industrial', enemy: lantern(),
          on: {
            success: [{ effects: [{ meter: 'lantern', add: -1 }], next: 'relief.debrief' }],
            failure: [{ effects: [{ meter: 'lantern', add: 1 }], next: 'relief.debrief' }],
            skip: [{ next: 'relief.after' }]
          } },
        { id: 'relief.debrief', type: 'debrief', text: 'Black Lantern pulls back, for now.', events: ['relief.wounded'], next: 'relief.after' },
        { id: 'relief.wounded', type: 'event', title: "Black Lantern's wounded", text: 'Their commander calls for a truce to recover the wounded.', options: [
          { id: 'let', text: 'Let them recover their wounded.', effects: [{ meter: 'lantern', add: 1 }, { flag: 'lantern_mercy' }] },
          { id: 'finish', text: 'Finish it.', effects: [{ meter: 'lantern', add: -2 }, { meter: 'loyalty', add: -1 }, { meter: 'sentiment', add: -1 }] },
          { id: 'prisoners', text: 'Take them prisoner.', effects: [{ meter: 'intel', add: 2 }, { meter: 'lantern', add: -1 }, { meter: 'htx', add: -1 }] }
        ] },
        { id: 'relief.after', type: 'happening', effects: [{ flag: 'htx_cut_off' }], next: 'relief.interlude' },
        interlude('relief.interlude', 'fault')
      ] },

      /* ---------- the shared events: the interludes, and the data core ---------- */
      { id: 'shared', shared: true, title: 'Between chapters', nodes: [
        { id: 'i.wake', type: 'event', if: { any: [{ wiped: { gte: 1 } }, { grade: ['defeat', 'rout'] }] }, title: 'The wake', text: 'The company buries its own.', options: [
          { id: 'pay', text: 'Pay the death benefits.', cost: { kUC: 1 }, why: 'There is nothing to pay them with.', effects: [{ meter: 'loyalty', add: 1 }] },
          { id: 'dont', text: 'Don\'t.', effects: [{ meter: 'loyalty', add: -1 }] }
        ] },
        { id: 'i.standdown', type: 'event', if: { meter: 'loyalty', lte: 0 }, title: 'Stand down', text: 'The company is tired, and says so.', options: [
          { id: 'rest', text: 'Give them a week off.', effects: [{ meter: 'loyalty', add: 1 }, { meter: 'hive', add: 1 }] },
          { id: 'push', text: 'Push on.', effects: [{ meter: 'loyalty', add: -1 }, { roll: { d6: 3, meter: 'loyalty' }, fail: [{ leave: 1 }] }] }
        ] },
        { id: 'i.audit', type: 'event', if: { flag: 'coverup' }, title: 'The audit', text: 'HTX\'s auditors want your logs.', options: [
          { id: 'doctor', text: 'Doctor them.', effects: [{ roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_cut_off' }, { meter: 'htx', add: -3 }] }] },
          { id: 'hand', text: 'Hand them over.', effects: [{ meter: 'htx', add: -2 }, { flag: 'coverup', set: false }] }
        ] },
        { id: 'i.offer', type: 'event', if: { any: [{ flag: 'htx_suspects' }, { flag: 'htx_cut_off' }] }, title: 'An offer from Black Lantern', text: 'They want to buy {unit:veteran}\'s contract.', options: [
          { id: 'sell', text: 'Sell it.', effects: [{ kUC: 4 }, { leave: 1 }, { meter: 'lantern', add: 1 }, { meter: 'loyalty', add: -1 }] },
          { id: 'refuse', text: 'Refuse.' }
        ] },
        { id: 'i.tunnels', type: 'event', if: { all: [{ meter: 'hive', gte: 4 }, { revealed: 'hive' }] }, title: 'Tunnel noises', text: 'Something is digging under the camp.', options: [
          { id: 'collapse', text: 'Pay a demolition crew to collapse a shaft.', cost: { kUC: 2 }, why: 'You can\'t afford the crew.', effects: [{ meter: 'hive', add: -1 }, { meter: 'htx', add: -1 }] },
          { id: 'leave', text: 'Leave it.', effects: [{ meter: 'hive', add: 1 }] }
        ] },
        { id: 'i.word', type: 'event', if: { meter: 'sentiment', gte: 2 }, title: 'Word from the town', text: 'A miner brings news.', options: [
          { id: 'listen', text: 'Listen.', effects: [{ meter: 'intel', add: 1 }, { reveal: 'rebels' }] },
          { id: 'send', text: 'Send them away.', effects: [{ meter: 'sentiment', add: -1 }] }
        ] },
        { id: 'h1.core', type: 'event', if: { any: [{ played: 'sump' }, { played: 'c4' }] }, title: 'The data core', text: '{soldier:tech} has the Deep Contract\'s data core, and HTX asks for it on an open channel.', options: [
          { id: 'hand', text: 'Hand it over.', effects: [{ meter: 'htx', add: 2 }] },
          { id: 'lost', text: '"Lost in the fighting."', effects: [{ flag: 'core_recovered' }, { flag: 'coverup' }, { reveal: 'hive' }] },
          { id: 'copy', text: 'Copy it, then hand it over.', effects: [{ meter: 'htx', add: 1 }, { flag: 'core_recovered' },
            { if: { not: { flag: 'ledger_read' } }, roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_suspects' }] }] }
        ] }
      ] },

      /* ================= the second half: Fault Lines ================= */
      { id: 'fault', half: 2, counts: false, title: 'Fault Lines', intro: 'The contract, as HTX wrote it, is over.', nodes: [
        { id: 'fault.brief', type: 'brief', text: 'The war has changed.{if htx_cut_off} HTX has stopped paying.{/if}', next: 'pool' },
        { id: 'pool', type: 'pool', picks: 3, then: 'end' }
      ] },

      // the Front
      poolChapter({ id: 'retake', thread: 'front', title: 'Retake the Refinery', when: { flag: 'refinery_lost' },
        brief: 'The refinery the Front took is to be taken back.',
        before: { id: 'retake.survivors', title: "The garrison's survivors", text: 'The old garrison offers to fight.', options: [
          { id: 'take', text: 'Take them.', if: { not: { flag: 'garrison_blamed' } }, why: 'Not after you blamed them.',
            battle: { allies: { side: 'garrison', faction: 'pmc', core: ['enforcers', 'regular'] } } },
          { id: 'alone', text: '"This is our fight."', effects: [{ meter: 'loyalty', add: 1 }] }
        ] },
        battle: { map: 'refinery', scenario: 'invasion', role: 'attacker', enemy: front({ tactics: 'laststand' }), adjust: [{ if: { flag: 'nightshift_freed' }, levers: { edge: 'choose' } }],
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'retake.holdouts', title: 'The holdouts', text: 'The last of them surrender.', if: { grade: 'success' }, options: [
          { id: 'hand', text: 'Hand them to HTX.', effects: [{ meter: 'htx', add: 1 }, { meter: 'sentiment', add: -2 }, { meter: 'rebels', add: -1 }] },
          { id: 'walk', text: 'Let them walk.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'rebels', add: 1 }] }
        ] },
        passed: [{ meter: 'rebels', add: 1 }] }),
      poolChapter({ id: 'revenge', thread: 'front', title: "Varga's Revenge", when: { any: [{ flag: 'varga_dead' }, { flag: 'varga_free' }] },
        brief: '{if varga_dead}Her brother leads them now.{/if}{if varga_free}She is back, and she wants you.{/if}',
        before: { id: 'revenge.challenge', title: 'The challenge', text: 'Her people ask to meet you.', options: [
          { id: 'meet', text: 'Meet them.', battle: { scenario: 'parley', name: 'Under a White Flag' }, effects: [{ meter: 'sentiment', add: 1 }] },
          { id: 'ambush', text: 'Ambush the meeting.', battle: { variant: { ambush: 'player' } }, effects: [{ meter: 'sentiment', add: -2 }, { meter: 'loyalty', add: -1 }, { flag: 'parley_betrayed' }] }
        ] },
        battle: { map: 'ridges', scenario: 'meeting', enemy: front({ tactics: 'wave' }), adjust: [{ if: { flag: 'martyr_displayed' }, levers: { readiness: 2 } }],
          on: { success: [{ effects: [{ meter: 'rebels', add: -2 }] }], failure: [{ effects: [{ meter: 'rebels', add: 1 }] }] } },
        after: { id: 'revenge.chance', title: 'The second chance', text: 'She is in your sights again.', if: { all: [{ grade: 'success' }, { flag: 'varga_free' }] }, options: [
          { id: 'take', text: 'Take her.', effects: [{ flag: 'varga_free', set: false }, { flag: 'varga_held' }, { meter: 'htx', add: 1 }] },
          { id: 'let', text: 'Let her go.', effects: [{ meter: 'sentiment', add: 2 }, { flag: 'varga_spared' }] }
        ] },
        passed: [{ meter: 'rebels', add: 1 }] }),
      poolChapter({ id: 'splinter', thread: 'front', fallback: true, title: 'The Splinter Cell',
        brief: 'A cell of the Front fights on in the hills.',
        before: { id: 'splinter.informant', title: 'The informant', text: 'A man in the cell will talk, for a price.', options: [
          { id: 'pay', text: 'Pay him.', cost: { kUC: 1 }, why: 'You can\'t pay him.', battle: { intel: 2 }, effects: [{ reveal: 'rebels' }] },
          { id: 'lean', text: 'Lean on him.', effects: [{ meter: 'intel', add: 1 }, { meter: 'sentiment', add: -1 }] }
        ] },
        battle: { map: 'hills', scenario: 'find', enemy: front({ tactics: 'guerillas' }),
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{}] } },
        after: { id: 'splinter.bomber', title: 'The bomb-maker', text: 'You have the cell\'s bomb-maker.', if: { grade: 'success' }, options: [
          { id: 'hand', text: 'Hand him to HTX.', effects: [{ meter: 'htx', add: 1 }, { meter: 'rebels', add: -1 }] },
          { id: 'turn', text: 'Turn him.', effects: [{ meter: 'intel', add: 2 }, { flag: 'informant' }] }
        ] } }),
      poolChapter({ id: 'redoubt', thread: 'front', finale: true, title: 'The Last Redoubt', when: { meter: 'rebels', gte: 1 },
        brief: '{if truce}The hardliners who refused the truce make their stand.{/if}{if not truce}The Front makes its last stand.{/if}',
        before: { id: 'redoubt.approach', title: 'The approach', text: 'The redoubt sits above the old shafts.', options: [
          { id: 'siege', text: 'Starve them for a week.', battle: { readiness: -1 }, effects: [{ meter: 'hive', add: 1 }] },
          { id: 'storm', text: 'Bombard and storm it.', if: { meter: 'htx', gte: 1 }, why: 'HTX won\'t lend the guns.', battle: { strikes: 'D6' }, effects: [{ meter: 'sentiment', add: -1 }] }
        ] },
        battle: { map: 'redoubt', scenario: 'takeover', role: 'attacker', tier: 'max', pl: 'max', enemy: front({ tactics: 'laststand', fill: { to: 1.0, from: ['rinsurgents', 'rhardened', 'rmilitia'], meter: 'rebels', step: 0.05 } }),
          adjust: [{ if: { flag: 'informant' }, levers: { intel: 1 } }, { if: { flag: 'truce' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia'] } } }],
          on: FINALE_ON } }),

      // the truce
      poolChapter({ id: 'ceasefire', thread: 'truce', title: 'The Ceasefire',
        when: { any: [{ flag: 'varga_talked' }, { flag: 'varga_released' }, { flag: 'varga_spared' }, { flag: 'hive_known' }, { meter: 'sentiment', gte: 3 }] },
        brief: 'The Front will talk, if you will.',
        before: { id: 'ceasefire.terms', title: 'Terms', text: '{if nightshift_shot}Varga first wants the officer who had the night shift shot. {/if}What will you offer?', options: [
          { id: 'files', text: 'Offer the Deep Contract files.', if: { all: [{ flag: 'core_recovered' }, { not: { flag: 'core_sold' } }] }, why: 'You don\'t have them to offer.',
            effects: [{ meter: 'sentiment', add: 3 }, { meter: 'htx', add: -2 }] },
          { id: 'money', text: 'Offer HTX\'s money.', if: { meter: 'htx', gte: 1 }, cost: { kUC: 2 }, why: 'HTX won\'t pay for peace.' },
          { id: 'nothing', text: 'Promise nothing.', effects: [{ roll: { d6: 4, meter: 'sentiment', mods: [{ if: { flag: 'pit9_spared' }, add: 1 }, { if: { flag: 'miners_sealed' }, add: -6 }] },
            fail: [{ next: { battle: 'ceasefire.battle', levers: { readiness: 1 } } }] }] },
          { id: 'officer', text: 'Hand over {soldier:command}.', if: { flag: 'nightshift_shot' }, effects: [{ leave: 1 }, { meter: 'loyalty', add: -2 }, { meter: 'sentiment', add: 2 }] }
        ] },
        battle: { map: 'waystation', scenario: 'parley', enemy: front({ tactics: 'guerillas', core: ['rminers', 'rmilitia'] }),
          adjust: [
            { if: { flag: 'gate_cleared' }, levers: { readiness: 1 } }, { if: { flag: 'pit9_shelled' }, levers: { readiness: 1 } },
            { if: { flag: 'parley_betrayed' }, levers: { readiness: 1 } }, { if: { flag: 'miners_sealed' }, levers: { readiness: 2 } }
          ],
          on: { success: [{ effects: [{ flag: 'truce' }, { meter: 'rebels', add: -2 }] }], failure: [{ effects: [{ meter: 'sentiment', add: -1 }] }] } },
        after: { id: 'ceasefire.peace', title: 'Who keeps the peace', text: 'The ceasefire holds, for now.', if: { flag: 'truce' }, options: [
          { id: 'report', text: 'Report the truce to HTX.', effects: [{ meter: 'htx', add: -1 }, { if: { meter: 'htx', lte: -2 }, flag: 'htx_cut_off' }] },
          { id: 'hide', text: 'Hide it from HTX.', effects: [{ flag: 'coverup' }] },
          { id: 'share', text: 'Share your supplies with the miners.', effects: [{ kUC: -1 }, { meter: 'sentiment', add: 1 }, { meter: 'loyalty', add: -1 }] }
        ] },
        passed: [{ meter: 'sentiment', add: -1 }] }),
      poolChapter({ id: 'holdline', thread: 'truce', fallback: true, title: 'Hold the Line', when: { any: [{ flag: 'truce' }, { flag: 'hive_known' }] },
        brief: 'Bugs boil out of the shafts, and the Front\'s people are in the way.',
        before: { id: 'holdline.gap', title: 'Who holds the gap', text: 'Someone has to hold it while the rest fall back.', options: [
          { id: 'ours', text: 'Your units hold it.', battle: { role: 'defender' }, effects: [{ meter: 'sentiment', add: 1 }] },
          { id: 'theirs', text: 'The rebels hold it.', battle: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia', 'rmilitia'] } }, effects: [{ meter: 'loyalty', add: 1 }, { meter: 'sentiment', add: -1 }] }
        ] },
        battle: { map: 'pass', scenario: 'holdline', waves: { meter: 'hive', base: 1, per: 3 }, enemy: hive(), adjust: [{ if: { flag: 'hive_known' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers'] } } }],
          on: { success: [{ effects: [{ meter: 'hive', add: -1 }] }], failure: [{ effects: [{ meter: 'hive', add: 1 }] }] } },
        after: { id: 'holdline.dead', title: 'The rebel dead', text: 'They held, and they died.', options: [
          { id: 'honour', text: 'Honour them with your own.', effects: [{ meter: 'sentiment', add: 2 }, { meter: 'loyalty', add: -1 }] },
          { id: 'own', text: 'Leave it to their own people.' }
        ] } }),

      // the hive
      poolChapter({ id: 'outbreak', thread: 'hive', title: 'Outbreak at Pit Nine', when: { any: [{ meter: 'hive', gte: 3 }, { flag: 'pit9_shelled' }] },
        brief: 'The hive has broken into Pit Nine\'s lower levels.',
        before: { id: 'outbreak.miners', title: 'The miners below', text: 'Miners are trapped below.', options: [
          { id: 'go', text: 'Go in for them.', effects: [{ flag: 'rescue', local: true }] },
          { id: 'seal', text: 'Seal them in.', battle: { skip: true }, effects: [{ meter: 'hive', add: -2 }, { meter: 'sentiment', add: -3 }, { meter: 'loyalty', add: -1 }, { flag: 'miners_sealed' }] },
          { id: 'guided', text: 'Let the townsfolk guide you in.', if: { flag: 'pit9_spared' }, why: 'The town won\'t help you.', battle: { intel: 1 } }
        ] },
        battle: { scenario: 'ce_clear', enemy: hive(),
          on: { success: [{ if: { flag: 'rescue' }, effects: [{ meter: 'sentiment', add: 2 }] }, {}], failure: [{ effects: [{ meter: 'hive', add: 1 }] }], skip: [{}] } },
        after: { id: 'outbreak.samples', title: 'Samples', text: 'Live hive tissue, in a crate.', options: [
          { id: 'give', text: 'Give HTX a live one.', effects: [{ meter: 'htx', add: 2 }, { meter: 'hive', add: 1 }, { flag: 'sample_taken' }] },
          { id: 'burn', text: 'Burn it all.', effects: [{ meter: 'hive', add: -1 }] }
        ] },
        passed: [{ meter: 'hive', add: 1 }] }),
      poolChapter({ id: 'shafts', thread: 'hive', fallback: true, title: 'The Shafts',
        brief: 'The hive\'s tunnels reach the surface in a dozen places.',
        before: { id: 'shafts.charges', title: 'Charges', text: 'The engineers have charges.', options: [
          { id: 'lay', text: 'Lay charges as you go.', battle: { strikes: 'D3' }, effects: [{ meter: 'hive', add: 1 }] },
          { id: 'quiet', text: 'Go quietly.', battle: { role: 'choose', readiness: 0 } }
        ] },
        battle: { scenario: 'ce_clear', enemy: hive(),
          on: { success: [{ effects: [{ meter: 'hive', add: -1 }] }], failure: [{ effects: [{ meter: 'hive', add: 1 }] }] } },
        after: { id: 'shafts.collapse', title: 'The collapse', text: 'The shafts could be brought down.', if: { grade: 'success' }, options: [
          { id: 'collapse', text: 'Bring the shafts down.', cost: { kUC: 1 }, why: 'You can\'t afford the explosives.',
            effects: [{ meter: 'hive', add: -2 }, { meter: 'htx', add: -1 }, { flag: 'shafts_collapsed' }] },
          { id: 'open', text: 'Leave them open for HTX.', effects: [{ meter: 'htx', add: 1 }] }
        ] } }),
      poolChapter({ id: 'hiveheart', thread: 'hive', finale: true, title: 'Hive Heart',
        brief: 'The brood chambers, at the bottom of everything.',
        before: { id: 'hiveheart.descent', title: 'The descent', text: 'There is one way down, and it is long.', options: [
          { id: 'burn', text: 'Burn the way down.', battle: { strikes: 'D3+PL', readiness: -1 }, effects: [{ meter: 'loyalty', add: -1 }] },
          { id: 'push', text: 'Push straight through.', battle: { role: 'attacker', tier: 'max' } }
        ] },
        battle: { scenario: 'hive_heart', waves: { meter: 'hive', base: 1, per: 3 }, tier: 'max', pl: 'max', enemy: hive({ fill: { to: 1.0, from: ['bsmall', 'battack', 'boversized'], meter: 'hive', step: 0.05 } }),
          adjust: [{ if: { flag: 'shafts_collapsed' }, levers: { readiness: -1 } }, { if: { flag: 'sample_taken' }, levers: { readiness: 1 } },
            { if: { flag: 'truce' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia'] } } }],
          on: FINALE_ON } }),

      // HTX and Black Lantern
      poolChapter({ id: 'partner', thread: 'htx', title: 'The Partner', when: { any: [{ flag: 'htx_suspects' }, { flag: 'htx_tracking' }, { meter: 'lantern', gte: 4 }] },
        brief: 'HTX sends Black Lantern to fight beside you, with orders of its own.',
        before: { id: 'partner.orders', title: 'Orders of its own', text: 'Black Lantern\'s officer asks to see your plans.', options: [
          { id: 'share', text: 'Share your plans.', battle: { allies: { side: 'lantern', faction: 'pmc', core: ['regular', 'lmgteam'] }, intel: 1 }, effects: [{ meter: 'lantern', add: 1 }] },
          { id: 'dark', text: 'Keep them in the dark.', effects: [{ meter: 'lantern', add: -1 }] },
          { id: 'tracker', text: 'Plant a tracker on them.', cost: { intel: 1 }, why: 'You don\'t know enough about them.',
            effects: [{ meter: 'intel', add: 1 }, { roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_cut_off' }] }] }
        ] },
        battle: { map: 'hills', scenario: 'find', enemy: front({ tactics: 'guerillas' }),
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'partner.prisoners', title: "Black Lantern's prisoners", text: 'Black Lantern has taken prisoners, and means to question them its own way.', options: [
          { id: 'let', text: 'Let them handle it.', effects: [{ meter: 'htx', add: 1 }, { meter: 'sentiment', add: -2 }, { meter: 'lantern', add: 1 }] },
          { id: 'take', text: 'Take the prisoners from them.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'lantern', add: -1 }, { flag: 'lantern_crossed' }] }
        ] },
        passed: [{ meter: 'lantern', add: 1 }] }),
      poolChapter({ id: 'leak', thread: 'htx', title: 'The Leak', when: { any: [{ flag: 'core_recovered' }, { flag: 'ledger_read' }, { flag: 'sample_taken' }] },
        brief: 'What HTX did under Kessler\'s Reach could be broadcast from its own uplink.',
        before: { id: 'leak.uplink', title: 'The uplink', text: 'The uplink is behind HTX\'s own guards.', options: [
          { id: 'night', text: 'Hit it by night.', battle: { tier: 'max-1', role: 'attacker' } },
          { id: 'talk', text: 'Talk your way into the HTX office.', cost: { intel: 2 }, why: 'You don\'t know enough to bluff.',
            effects: [{ roll: { d6: 4, meter: 'intel' }, pass: [{ next: { battle: 'leak.battle', levers: { skip: true } } }] }] }
        ] },
        battle: { map: 'uplink', scenario: 'strike', enemy: lantern({ core: ['regular', 'lmgteam'] }),
          on: { success: [{ effects: [{ meter: 'lantern', add: -1 }] }], failure: [{ effects: [{ meter: 'lantern', add: 1 }] }], skip: [{}] } },
        after: { id: 'leak.publish', title: 'Publish', text: 'The files are yours to use.', options: [
          { id: 'broadcast', text: 'Broadcast them.', effects: [{ flag: 'leaked' }, { flag: 'htx_cut_off' }, { meter: 'htx', add: -5 }, { meter: 'sentiment', add: 3 }, { meter: 'lantern', add: 2 },
            { if: { flag: 'varga_handed' }, flag: 'varga_free' }] },
          { id: 'sell', text: 'Sell them back to HTX.', effects: [{ kUC: 6 }, { meter: 'htx', add: 1 }, { flag: 'core_sold' }] },
          { id: 'varga', text: 'Give them to Varga.', if: { any: [{ flag: 'varga_held' }, { flag: 'varga_talked' }] }, why: 'You\'d need Varga.', effects: [{ meter: 'sentiment', add: 2 }, { meter: 'rebels', add: 1 }] }
        ] } }),
      poolChapter({ id: 'convoy', thread: 'htx', fallback: true, title: 'Convoy',
        brief: '{if core_recovered}The data core has to cross the moon.{/if}{if not core_recovered}HTX ore has to cross the moon.{/if}',
        before: { id: 'convoy.route', title: 'The route', text: 'Two roads.', options: [
          { id: 'fast', text: 'The fast road.', battle: { role: 'attacker' } },
          { id: 'mine', text: 'The mine road.', battle: { readiness: 0 }, effects: [{ meter: 'hive', add: 1 }, { meter: 'loyalty', add: -1 }] }
        ] },
        battle: { map: 'haulroad', scenario: 'convoy', enemy: lantern(), adjust: [{ if: { flag: 'driver_taken' }, levers: { readiness: 1 } }],
          on: { success: [{ effects: [{ meter: 'lantern', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'convoy.cargo', title: 'The cargo', text: 'It got through.', if: { grade: 'success' }, options: [
          { id: 'deliver', text: 'Deliver it as ordered.', effects: [{ meter: 'htx', add: 1 }] },
          { id: 'skim', text: 'Skim it.', effects: [{ kUC: 2 }, { meter: 'loyalty', add: 1 }, { roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_suspects' }] }] },
          { id: 'miners', text: 'Give it to the miners.', effects: [{ meter: 'sentiment', add: 2 }, { meter: 'htx', add: -2 }, { meter: 'rebels', add: 1 }] }
        ] } }),
      poolChapter({ id: 'showdown', thread: 'htx', finale: true, title: 'The Showdown',
        brief: 'Black Lantern comes for you.',
        before: { id: 'showdown.terms', title: 'Last words', text: 'Black Lantern\'s commander comes forward under a white flag.', options: [
          { id: 'parley', text: 'Hear the terms.', if: { flag: 'lantern_mercy' }, why: 'They owe you nothing.', battle: { scenario: 'parley', name: 'Last Words' } },
          { id: 'fight', text: 'Shoot the flag down.', battle: { role: 'attacker' }, effects: [{ meter: 'loyalty', add: 1 }, { meter: 'sentiment', add: -1 }] }
        ] },
        battle: { map: 'htxyard', scenario: 'takeover', tier: 'max', pl: 'max', variant: { target: 'Lantern Actual' }, enemy: lantern({ fill: { to: 1.0, from: ['regular', 'veterans', 'lmgteam'], meter: 'lantern', step: 0.05 } }),
          adjust: [{ if: { flag: 'truce' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia'] } } }],
          on: {
            success: [{ effects: [{ flag: 'finale_won' }] }],
            draw: [{ if: { meter: 'lantern', gte: 7 }, effects: [{ flag: 'finale_lost' }, { flag: 'showdown_lost' }] }, { effects: [{ flag: 'finale_won' }] }],
            defeat: [{ effects: [{ flag: 'finale_lost' }, { flag: 'showdown_lost' }] }],
            rout: [{ effects: [{ flag: 'finale_lost' }, { flag: 'showdown_lost' }] }]
          } } }),

      // the Breakout: the hive has won the moon
      { id: 'breakout', half: 2, title: 'Breakout', onStart: [{ flag: 'scorched' }], nodes: [
        { id: 'breakout.brief', type: 'brief', text: 'HTX orders Kessler\'s Reach sterilised from orbit. Get out.', next: 'breakout.order' },
        { id: 'breakout.order', type: 'event', title: 'The last shuttle', text: 'There is room for the company, and not much else.', options: [
          { id: 'civilians', text: 'Take civilians.', battle: { tier: 'max-1', turns: 8 }, effects: [{ meter: 'sentiment', add: 2 }] },
          { id: 'company', text: 'Take only the company.', battle: { edge: 'choose', turns: 6 }, effects: [{ meter: 'loyalty', add: 1 }] }
        ], next: 'breakout.battle' },
        { id: 'breakout.battle', type: 'battle', map: 'slagfields', scenario: 'breakout', waves: { meter: 'hive', base: 1, per: 3 }, tier: 'max', pl: 'max', enemy: hive(),
          on: FINALE_ON, next: 'end' }
      ] },

      { id: 'end', half: 2, counts: false, title: 'The end', nodes: [{ id: 'end.node', type: 'ending' }] }
    ],

    endings: [
      { id: 'broken', broken: true, title: 'Broken Company', text: 'There is not enough of {name} left to field an army. The last of it ships out on an ore freighter, in the hold, and Kessler’s Reach goes on without it.' },
      { id: 'scorched', title: 'Scorched Earth', text: 'The hive got away from everyone. HTX ordered Kessler’s Reach sterilised from orbit, and {name} watched it burn from the last shuttle out.', if: { flag: 'scorched' } },
      { id: 'terminated', title: 'Contract Terminated', text: 'HTX turned on {name}, and Black Lantern finished the job. The company is betrayed, unpaid and running, and its name is on a list it will not get off.', if: { any: [{ flag: 'showdown_lost' }, { all: [{ flag: 'htx_cut_off' }, { flag: 'finale_lost' }] }] } },
      { id: 'liberators', title: 'Liberators', text: 'The Front holds Kessler’s Reach, and {name} helped it get there. The company leaves poorer than it came, and every one of its people knows why.', if: { all: [{ any: [{ flag: 'truce' }, { flag: 'leaked' }] }, { flag: 'finale_won' }, { meter: 'hive', lt: 8 }, { not: { flag: 'miners_sealed' } }] } },
      { id: 'companyman', title: 'Company Man', text: 'HTX is satisfied. The ore trains run, the contract is paid in full with a bonus on top, and {name} leaves Kessler’s Reach rich. The moon it leaves behind is broken.', if: { all: [{ not: { any: [{ flag: 'truce' }, { flag: 'leaked' }, { flag: 'htx_cut_off' }] } }, { meter: 'hive', lt: 8 },
        { any: [{ meter: 'htx', gte: 2 }, { all: [{ flag: 'core_sold' }, { meter: 'htx', gte: 1 }] }] }] } },
      { id: 'paidoff', title: 'Paid Off', text: 'The war on Kessler’s Reach ends without {name} deciding it. HTX pays what it owes, or most of it, and the company ships out with its dead and its debts.' }
    ],

    /* The epilogue (story.js epilogue): for each thing it is about, the first
       line that fits, in this order. Its conditions are read for the text only. */
    epilogue: [
      // the moon
      { about: 'moon', ending: 'scorched', text: 'Kessler’s Reach burned for three days. HTX wrote the moon off against tax, and the Deep Contract was never mentioned again.' },
      { about: 'moon', ending: 'liberators', text: 'The Front runs the mines now, badly at first and then less badly. The pits pay their own people for the first time in forty years.' },
      { about: 'moon', ending: 'companyman', text: 'HTX’s ore trains run on time again. The miners went back down the shafts because there was nowhere else to go.' },
      { about: 'moon', ending: 'terminated', text: 'Black Lantern held Kessler’s Reach for HTX for another eleven years.' },
      { about: 'moon', if: { flag: 'truce' }, text: 'The truce lasted longer than anyone expected. The Front and HTX are still arguing over the terms.' },
      { about: 'moon', text: 'Kessler’s Reach went back to work, after a fashion. Nobody there talks about the war, and nobody has forgotten it.' },
      // Varga
      { about: 'varga', if: { all: [{ flag: 'varga_dead' }, { flag: 'martyr_displayed' }] }, text: 'Ada Varga’s body hung at the port gates for a week. Every pit on the moon has her picture on a wall now.' },
      { about: 'varga', if: { flag: 'varga_dead' }, text: 'Ada Varga is buried in Pit Four, under a stone her people cut themselves. Her brother still visits it.' },
      { about: 'varga', if: { all: [{ flag: 'varga_handed' }, { not: { flag: 'varga_free' } }] }, text: 'Ada Varga was taken off the moon in an HTX prison ship. Nobody has heard from her since.' },
      { about: 'varga', if: { flag: 'varga_spared' }, text: 'Ada Varga lived. She told anyone who asked that a mercenary called {commander} had let her go, and that she never understood why.' },
      { about: 'varga', if: { flag: 'varga_free' }, text: 'Ada Varga is still on Kessler’s Reach, still in charge of whatever the Front has become.' },
      { about: 'varga', if: { flag: 'varga_held' }, text: 'Ada Varga left Kessler’s Reach in {name}’s custody, and was handed over at the next port, as the contract said.' },
      { about: 'varga', if: { flag: 'varga_talked' }, text: 'Ada Varga told {commander} why the miners rose. It has not been forgotten.' },
      { about: 'varga', text: 'Nobody is sure what became of Ada Varga. In the pits, they say she is still down there.' },
      // the hive
      { about: 'hive', ending: 'scorched', text: 'Whatever was under the moon burned with it, or so HTX says.' },
      { about: 'hive', if: { flag: 'sample_taken' }, text: 'HTX’s research division has a live sample of the hive, in a vault on a moon you have never heard of.' },
      { about: 'hive', if: { flag: 'shafts_collapsed' }, text: 'The collapsed shafts stayed shut. Sometimes, in the deepest pits, the miners still hear digging.' },
      { about: 'hive', if: { meter: 'hive', gte: 5 }, text: 'The hive is still down there, and still growing. HTX has stopped sending survey teams.' },
      { about: 'hive', if: { flag: 'sump_entered' }, text: 'The hive under Kessler’s Reach went quiet. It has not gone away.' },
      // Pit Nine and the town
      { about: 'town', if: { flag: 'miners_sealed' }, text: 'The galleries you sealed under Pit Nine were never opened. There is a list of names on the pithead, and the company is not on it.' },
      { about: 'town', if: { flag: 'pit9_shelled' }, text: 'Pit Nine rebuilt its school with the money it never got from HTX. The new one has no windows on the side facing the port.' },
      { about: 'town', if: { flag: 'pit9_spared' }, text: 'The teacher from Pit Nine wrote to the company once, to say the school was open again.' },
      // the paymasters
      { about: 'htx', if: { flag: 'leaked' }, text: 'The Deep Contract files went out on every channel in the sector. HTX’s board resigned. Nobody went to prison.' },
      { about: 'htx', if: { flag: 'core_sold' }, text: 'HTX paid very well for its files back, and has never hired {name} again.' },
      { about: 'htx', if: { flag: 'htx_cut_off' }, text: 'HTX still owes {name} three months’ pay. The lawyers expect it to be settled in about eleven years.' },
      // Black Lantern
      { about: 'lantern', if: { flag: 'lantern_mercy' }, text: 'Black Lantern’s commander sent a case of something expensive to the company’s next posting, with no note.' },
      { about: 'lantern', if: { flag: 'lantern_crossed' }, text: 'Black Lantern has not forgotten the prisoners. Neither has {name}.' },
      // the company
      { about: 'company', if: { meter: 'loyalty', gte: 2 }, text: 'The company that came off Kessler’s Reach with {commander} was smaller than the one that landed, and closer.' },
      { about: 'company', if: { meter: 'loyalty', lte: -1 }, text: 'Half the company signed on elsewhere before the next contract. The ones who stayed with {commander} don’t talk about the moon.' },
      { about: 'company', text: '{commander} took {name} on to the next contract, as commanders do.' }
    ]
  })));;

  if (typeof module !== 'undefined' && module.exports) module.exports = S.get('deep-contract');
})(typeof window !== 'undefined' ? window : global);
