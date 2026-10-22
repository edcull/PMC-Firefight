/* PMC 2670 — Firefight : Deep Contract, the first story (docs/story-mode-plan.md)

   The story bible as data (phase 0): every chapter, event, battle, thread and
   ending in the plan, each event's situation and options in a line, and the
   meters and flags each one moves. No prose yet: the text is the plan's own
   one-liners, to be written properly once the slice has been played.

   Scenarios the second half will have of its own (phase 5: Hive Heart,
   Convoy, Breakout, Hold the Line, Strike, Parley) stand in here as the
   nearest existing scenario with a variant naming them. Enemy forces name
   their troops; the battle hooks (levers.js) add the leader for the Battle
   Tier, scale the optional units by their meter and fill to fit the company. */
(function (root) {
  'use strict';
  var S = root.PMCStory || require('./story.js');

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
      fill: { to: 0.9, from: ['rmilitia', 'rtechnical', 'rminers', 'rinsurgents'], meter: 'rebels', step: 0.05 },
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

  var FINALE_ON = {
    success: [{ effects: [{ flag: 'finale_won' }] }],
    failure: [{ effects: [{ flag: 'finale_lost' }] }]
  };

  S.register({
    id: 'deep-contract', name: 'Deep Contract', version: 1, length: 8,
    start: { faction: 'pmc', found: 'standard' },
    meters: {
      htx: { start: 1, shown: true, name: 'HTX Standing', uses: ['pay', 'strikes', 'supply'], thresholds: [{ gte: 2 }, { lte: -3 }] },
      sentiment: { start: 0, name: 'Sentiment', uses: ['showEnemy', 'readiness'], thresholds: [{ gte: 3 }, { lte: -2 }, { lte: -3 }] },
      loyalty: { start: 1, shown: true, name: 'Loyalty', uses: ['reroll', 'suppression'], thresholds: [{ gte: 2 }, { lte: 0 }, { lte: -2 }] },
      intel: { start: 1, min: 0, max: 6, shown: true, name: 'Intel', uses: ['reveal'], thresholds: [{ gte: 4 }, { gte: 6 }] },
      rebels: { start: 5, min: 0, max: 10, name: 'Rebel Strength', uses: ['force'], thresholds: [{ lte: 0 }, { gte: 7 }] },
      hive: { start: 0, min: 0, max: 10, name: 'Hive Growth', uses: ['force', 'tunnel'], twoWay: [2], thresholds: [{ gte: 3 }, { gte: 5 }, { gte: 8 }] },
      lantern: { start: 2, min: 0, max: 10, name: 'Black Lantern Strength', uses: ['force'], thresholds: [{ gte: 4 }, { gte: 7 }] }
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
          { id: 'ask', text: 'Ask what they know, and not nicely.', battle: { showEnemy: true }, effects: [{ meter: 'sentiment', add: -1 }] }
        ], next: 'c1.battle' },
        { id: 'c1.battle', type: 'battle', scenario: 'secure', tier: 1, pl: 1, planet: 'industrial',
          enemy: front({ core: ['rminers', 'rmilitia'], optional: { meter: 'rebels', per: 3, units: ['rmilitia', 'rtechnical'] } }),
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
        { id: 'c2r.battle', type: 'battle', scenario: 'invasion', role: 'defender', tier: 'max', pl: 1, planet: 'industrial',
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
          { id: 'pay', text: 'Pay him.', cost: { kUC: 1 }, why: 'You can\'t pay him.', battle: { showEnemy: true } },
          { id: 'grab', text: 'Grab him and question him.', effects: [{ meter: 'intel', add: 1 }, { meter: 'loyalty', add: -1 }, { flag: 'driver_taken' }] },
          { id: 'blind', text: 'Go in blind, now, before the rota changes.', battle: { role: 'attacker', readiness: 0 } },
          { id: 'night', text: 'A small team, by night.', battle: { tier: 'max-1' } }
        ], next: 'c2d.battle' },
        { id: 'c2d.battle', type: 'battle', scenario: 'demolish', role: 'attacker', tier: 'max', pl: 1, planet: 'industrial',
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
        { id: 'c3.battle', type: 'battle', scenario: 'find', tier: 'max', pl: 1, planet: 'mountain',
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
          { id: 'clear', text: 'Clear it room by room.', battle: { scenario: 'ce_control' }, effects: [{ flag: 'pit9_clearing', local: true }] },
          { id: 'shell', text: 'Shell it, then storm the town.', battle: { strikes: 'D6' },
            effects: [{ meter: 'sentiment', add: -4 }, { meter: 'hive', add: 1 }, { meter: 'loyalty', add: -1 }, { flag: 'pit9_shelled' }] },
          { id: 'talk', text: 'Talk to the teacher.', if: { any: [{ flag: 'nightshift_freed' }, { flag: 'varga_held' }] }, why: 'You\'d need the miners\' trust, or Varga.',
            effects: [{ roll: { d6: 4, meter: 'sentiment', mods: [{ if: { flag: 'gate_cleared' }, add: -1 }] },
              pass: [{ meter: 'sentiment', add: 2 }, { flag: 'pit9_spared' }, { next: { battle: 'c4.battle', levers: { skip: true } } }],
              fail: [{ next: { battle: 'c4.battle', levers: { scenario: 'meeting', variant: { ambush: true } } } }] }] }
        ], next: 'c4.battle' },
        { id: 'c4.battle', type: 'battle', scenario: 'secure', tier: 'max', pl: 1, planet: 'industrial', enemy: front({ tactics: 'laststand' }),
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
        { id: 'relief.battle', type: 'battle', scenario: 'meeting', tier: 'max', pl: 1, planet: 'industrial', enemy: lantern(),
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
        battle: { scenario: 'invasion', role: 'attacker', enemy: front({ tactics: 'laststand' }), adjust: [{ if: { flag: 'nightshift_freed' }, levers: { edge: 'choose' } }],
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'retake.holdouts', title: 'The holdouts', text: 'The last of them surrender.', if: { grade: 'success' }, options: [
          { id: 'hand', text: 'Hand them to HTX.', effects: [{ meter: 'htx', add: 1 }, { meter: 'sentiment', add: -2 }, { meter: 'rebels', add: -1 }] },
          { id: 'walk', text: 'Let them walk.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'rebels', add: 1 }] }
        ] },
        passed: [{ meter: 'rebels', add: 1 }] }),
      poolChapter({ id: 'revenge', thread: 'front', title: "Varga's Revenge", when: { any: [{ flag: 'varga_dead' }, { flag: 'varga_free' }] },
        brief: '{if varga_dead}Her brother leads them now.{/if}{if varga_free}She is back, and she wants you.{/if}',
        before: { id: 'revenge.challenge', title: 'The challenge', text: 'Her people ask to meet you.', options: [
          { id: 'meet', text: 'Meet them.', battle: { scenario: 'meeting', variant: { name: 'Parley' } }, effects: [{ meter: 'sentiment', add: 1 }] },
          { id: 'ambush', text: 'Ambush the meeting.', battle: { variant: { ambush: 'player' } }, effects: [{ meter: 'sentiment', add: -2 }, { meter: 'loyalty', add: -1 }, { flag: 'parley_betrayed' }] }
        ] },
        battle: { scenario: 'meeting', enemy: front({ tactics: 'wave' }), adjust: [{ if: { flag: 'martyr_displayed' }, levers: { readiness: 2 } }],
          on: { success: [{ effects: [{ meter: 'rebels', add: -2 }] }], failure: [{ effects: [{ meter: 'rebels', add: 1 }] }] } },
        after: { id: 'revenge.chance', title: 'The second chance', text: 'She is in your sights again.', if: { all: [{ grade: 'success' }, { flag: 'varga_free' }] }, options: [
          { id: 'take', text: 'Take her.', effects: [{ flag: 'varga_free', set: false }, { flag: 'varga_held' }, { meter: 'htx', add: 1 }] },
          { id: 'let', text: 'Let her go.', effects: [{ meter: 'sentiment', add: 2 }, { flag: 'varga_spared' }] }
        ] },
        passed: [{ meter: 'rebels', add: 1 }] }),
      poolChapter({ id: 'splinter', thread: 'front', fallback: true, title: 'The Splinter Cell',
        brief: 'A cell of the Front fights on in the hills.',
        before: { id: 'splinter.informant', title: 'The informant', text: 'A man in the cell will talk, for a price.', options: [
          { id: 'pay', text: 'Pay him.', cost: { kUC: 1 }, why: 'You can\'t pay him.', battle: { showEnemy: true }, effects: [{ reveal: 'rebels' }] },
          { id: 'lean', text: 'Lean on him.', effects: [{ meter: 'intel', add: 1 }, { meter: 'sentiment', add: -1 }] }
        ] },
        battle: { scenario: 'find', enemy: front({ tactics: 'guerillas' }),
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
        battle: { scenario: 'takeover', role: 'attacker', tier: 'max', pl: 'max', enemy: front({ tactics: 'laststand', fill: { to: 1.0, from: ['rinsurgents', 'rhardened', 'rmilitia'], meter: 'rebels', step: 0.05 } }),
          adjust: [{ if: { flag: 'informant' }, levers: { showEnemy: true } }, { if: { flag: 'truce' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia'] } } }],
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
        battle: { scenario: 'meeting', variant: { name: 'Parley' }, enemy: front({ tactics: 'guerillas', core: ['rminers', 'rmilitia'] }),
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
        battle: { scenario: 'secure', variant: { name: 'Hold the Line', turns: 8 }, enemy: hive(), adjust: [{ if: { flag: 'hive_known' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers'] } } }],
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
          { id: 'guided', text: 'Let the townsfolk guide you in.', if: { flag: 'pit9_spared' }, why: 'The town won\'t help you.', battle: { showEnemy: true } }
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
          { id: 'burn', text: 'Burn the way down.', battle: { strikes: 'D3+PL', edge: 'choose' }, effects: [{ meter: 'loyalty', add: -1 }] },
          { id: 'push', text: 'Push straight through.', battle: { role: 'attacker', tier: 'max' } }
        ] },
        battle: { scenario: 'ce_clear', variant: { name: 'Hive Heart' }, tier: 'max', pl: 'max', enemy: hive({ fill: { to: 1.0, from: ['bsmall', 'battack', 'boversized'], meter: 'hive', step: 0.05 } }),
          adjust: [{ if: { flag: 'shafts_collapsed' }, levers: { readiness: -1 } }, { if: { flag: 'sample_taken' }, levers: { readiness: 1 } },
            { if: { flag: 'truce' }, levers: { allies: { side: 'front', faction: 'rebel', core: ['rminers', 'rmilitia'] } } }],
          on: FINALE_ON } }),

      // HTX and Black Lantern
      poolChapter({ id: 'partner', thread: 'htx', title: 'The Partner', when: { any: [{ flag: 'htx_suspects' }, { flag: 'htx_tracking' }, { meter: 'lantern', gte: 4 }] },
        brief: 'HTX sends Black Lantern to fight beside you, with orders of its own.',
        before: { id: 'partner.orders', title: 'Orders of its own', text: 'Black Lantern\'s officer asks to see your plans.', options: [
          { id: 'share', text: 'Share your plans.', battle: { allies: { side: 'lantern', faction: 'pmc', core: ['regular', 'lmgteam'] }, showEnemy: true }, effects: [{ meter: 'lantern', add: 1 }] },
          { id: 'dark', text: 'Keep them in the dark.', effects: [{ meter: 'lantern', add: -1 }] },
          { id: 'tracker', text: 'Plant a tracker on them.', cost: { intel: 1 }, why: 'You don\'t know enough about them.',
            effects: [{ meter: 'intel', add: 1 }, { roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_cut_off' }] }] }
        ] },
        battle: { scenario: 'find', enemy: front({ tactics: 'guerillas' }),
          on: { success: [{ effects: [{ meter: 'rebels', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'partner.prisoners', title: "Black Lantern's prisoners", text: 'Black Lantern has taken prisoners, and means to question them its own way.', options: [
          { id: 'let', text: 'Let them handle it.', effects: [{ meter: 'htx', add: 1 }, { meter: 'sentiment', add: -2 }, { meter: 'lantern', add: 1 }] },
          { id: 'take', text: 'Take the prisoners from them.', effects: [{ meter: 'sentiment', add: 1 }, { meter: 'lantern', add: -1 }, { flag: 'lantern_crossed' }] }
        ] },
        passed: [{ meter: 'lantern', add: 1 }] }),
      poolChapter({ id: 'leak', thread: 'htx', title: 'The Leak', when: { any: [{ flag: 'core_recovered' }, { flag: 'ledger_read' }, { flag: 'sample_taken' }] },
        brief: 'What HTX did under Kessler\'s Reach could be broadcast from its own uplink.',
        before: { id: 'leak.uplink', title: 'The uplink', text: 'The uplink is behind HTX\'s own guards.', options: [
          { id: 'night', text: 'Hit it by night.', battle: { tier: 'max-1', variant: { name: 'Strike' } } },
          { id: 'talk', text: 'Talk your way into the HTX office.', cost: { intel: 2 }, why: 'You don\'t know enough to bluff.',
            effects: [{ roll: { d6: 4, meter: 'intel' }, pass: [{ next: { battle: 'leak.battle', levers: { skip: true } } }] }] }
        ] },
        battle: { scenario: 'demolish', role: 'attacker', enemy: lantern({ core: ['regular', 'lmgteam'] }),
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
        battle: { scenario: 'meeting', variant: { name: 'Convoy' }, enemy: lantern(), adjust: [{ if: { flag: 'driver_taken' }, levers: { readiness: 1 } }],
          on: { success: [{ effects: [{ meter: 'lantern', add: -1 }] }], failure: [{ effects: [{ meter: 'htx', add: -1 }] }] } },
        after: { id: 'convoy.cargo', title: 'The cargo', text: 'It got through.', if: { grade: 'success' }, options: [
          { id: 'deliver', text: 'Deliver it as ordered.', effects: [{ meter: 'htx', add: 1 }] },
          { id: 'skim', text: 'Skim it.', effects: [{ kUC: 2 }, { meter: 'loyalty', add: 1 }, { roll: { d6: 4, meter: 'intel' }, fail: [{ flag: 'htx_suspects' }] }] },
          { id: 'miners', text: 'Give it to the miners.', effects: [{ meter: 'sentiment', add: 2 }, { meter: 'htx', add: -2 }, { meter: 'rebels', add: 1 }] }
        ] } }),
      poolChapter({ id: 'showdown', thread: 'htx', finale: true, title: 'The Showdown',
        brief: 'Black Lantern comes for you.',
        before: { id: 'showdown.terms', title: 'Last words', text: 'Black Lantern\'s commander comes forward under a white flag.', options: [
          { id: 'parley', text: 'Hear the terms.', if: { flag: 'lantern_mercy' }, why: 'They owe you nothing.', battle: { variant: { name: 'Parley' }, scenario: 'meeting' } },
          { id: 'fight', text: 'Shoot the flag down.', battle: { role: 'attacker' }, effects: [{ meter: 'loyalty', add: 1 }, { meter: 'sentiment', add: -1 }] }
        ] },
        battle: { scenario: 'takeover', tier: 'max', pl: 'max', variant: { target: 'Lantern Actual' }, enemy: lantern({ fill: { to: 1.0, from: ['regular', 'veterans', 'lmgteam'], meter: 'lantern', step: 0.05 } }),
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
        { id: 'breakout.battle', type: 'battle', scenario: 'takeover', variant: { name: 'Breakout' }, tier: 'max', pl: 'max', enemy: hive(),
          on: FINALE_ON, next: 'end' }
      ] },

      { id: 'end', half: 2, counts: false, title: 'The end', nodes: [{ id: 'end.node', type: 'ending' }] }
    ],

    endings: [
      { id: 'broken', broken: true, title: 'Broken Company' },
      { id: 'scorched', title: 'Scorched Earth', if: { flag: 'scorched' } },
      { id: 'terminated', title: 'Contract Terminated', if: { any: [{ flag: 'showdown_lost' }, { all: [{ flag: 'htx_cut_off' }, { flag: 'finale_lost' }] }] } },
      { id: 'liberators', title: 'Liberators', if: { all: [{ any: [{ flag: 'truce' }, { flag: 'leaked' }] }, { flag: 'finale_won' }, { meter: 'hive', lt: 8 }, { not: { flag: 'miners_sealed' } }] } },
      { id: 'companyman', title: 'Company Man', if: { all: [{ not: { any: [{ flag: 'truce' }, { flag: 'leaked' }, { flag: 'htx_cut_off' }] } }, { meter: 'hive', lt: 8 },
        { any: [{ meter: 'htx', gte: 2 }, { all: [{ flag: 'core_sold' }, { meter: 'htx', gte: 1 }] }] }] } },
      { id: 'paidoff', title: 'Paid Off' }
    ]
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = S.get('deep-contract');
})(typeof window !== 'undefined' ? window : global);
