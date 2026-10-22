/* A tiny story for the story engine's tests: every node type, a one-off
   reached by an extreme choice, a second half drawn from a pool of threads,
   a finale override and a catch-all ending. Written to pass the validator. */
'use strict';
const S = require('../src/story/story.js');

module.exports = S.register({
  id: 'test-story', name: 'Test story', version: 1, length: 5,
  meters: {
    htx: { start: 1, shown: true, name: 'HTX Standing', uses: ['pay'] },
    hive: { start: 0, min: 0, max: 10, name: 'Hive Growth', twoWay: [2], thresholds: [{ gte: 5 }] }
  },
  everyChapter: [{ if: { chapter: { gte: 3 } }, meter: 'hive', add: 1 }],
  threads: {
    front: { name: 'The Front', pressure: [{ meter: 'htx', w: -1 }, { flag: 'dead', w: 2 }] },
    hive: { name: 'The hive', pressure: [{ meter: 'hive', w: 1 }] },
    truce: { name: 'The truce', finale: false, pressure: [{ flag: 'spared', w: 3 }] }
  },
  finaleOverride: [{ if: { meter: 'hive', gte: 8 }, chapter: 'breakout' }],
  chapters: [
    { id: 'c1', half: 1, title: 'The Hunt', nodes: [
      { id: 'c1.brief', type: 'brief', text: '{name} lands.{if spared} Nobody died.{/if}', next: 'c1.choice' },
      { id: 'c1.choice', type: 'event', title: 'Kill or capture', text: '{soldier:veteran} has an opinion.', options: [
        { id: 'gunship', text: 'Call the gunship.', if: { meter: 'htx', gte: 1 }, why: 'HTX will not lend it.',
          battle: { strikes: 'D3' }, effects: [{ meter: 'htx', add: 1 }, { flag: 'aim_kill', local: true }] },
        { id: 'snatch', text: 'Send the snatch team.',
          battle: { variant: { target: 'rmilitia', capture: true }, tier: 'max-1' }, effects: [{ flag: 'aim_capture', local: true }] },
        { id: 'talk', text: 'Talk her down.', cost: { htx: 1 },
          battle: { skip: true }, effects: [{ flag: 'spared' }] }
      ], next: 'c1.battle' },
      { id: 'c1.battle', type: 'battle', scenario: 'find', tier: 'max', pl: 1,
        enemy: { side: 'front', faction: 'rebel', core: ['rmilitia', 'rciv'], optional: { meter: 'htx', per: 2, units: ['rinsurgents'] } },
        adjust: [{ if: { flag: 'aim_kill' }, levers: { showEnemy: true } }],
        on: {
          success: [{ if: { flag: 'aim_capture' }, effects: [{ flag: 'captured' }], next: 'c1.debrief' },
                    { effects: [{ flag: 'dead' }], next: 'c1.debrief' }],
          failure: [{ effects: [{ meter: 'htx', add: -1 }, { flag: 'escaped' }], next: 'c1.debrief' }],
          skip: [{ effects: [{ meter: 'htx', add: -1 }], next: 'c1.end' }]
        } },
      { id: 'c1.debrief', type: 'debrief', text: 'It is over.', events: ['c1.cell', 'c1.door'], next: 'c1.end' },
      { id: 'c1.cell', type: 'event', if: { flag: 'captured' }, title: 'The cell', options: [
        { id: 'hand', text: 'Hand her over.', effects: [{ meter: 'htx', add: 2 }] },
        { id: 'release', text: 'Let her go.', extreme: true, effects: [{ flag: 'released' }, { meter: 'htx', add: -2 }] },
        { id: 'keep', text: 'Keep her.', effects: [{ flag: 'held' }, { exp: 1 }] }
      ] },
      { id: 'c1.door', type: 'event', if: { flag: 'escaped' }, title: 'The sealed door', options: [
        { id: 'follow', text: 'Blast it and follow.', extreme: true, effects: [{ flag: 'followed' }, { meter: 'hive', add: 2 }] },
        { id: 'wait', text: 'Let her go for now.', effects: [{ kUC: 1 }] }
      ] },
      { id: 'c1.end', type: 'branch', when: [
        { if: { any: [{ flag: 'followed' }, { flag: 'released' }, { meter: 'htx', lte: -3 }] }, next: 'sump' },
        { next: 'c2' }
      ] }
    ] },
    { id: 'sump', half: 1, oneOff: true, title: 'Into the Sump', nodes: [
      { id: 'sump.battle', type: 'battle', scenario: 'ce_clear', enemy: { side: 'hive', faction: 'bugs', core: ['bsmall', 'btiny'] },
        on: {
          success: [{ effects: [{ reveal: 'hive' }], next: 'c2' }],
          failure: [{ effects: [{ meter: 'hive', add: 1 }, { reveal: 'hive' }], next: 'c2' }]
        } }
    ] },
    { id: 'c2', half: 2, title: 'Fault Lines', nodes: [
      { id: 'c2.time', type: 'happening', effects: [
        { roll: { d6: 4, mods: [{ meter: 'htx' }] }, pass: [{ journal: 'HTX pays on time.' }], fail: [{ meter: 'hive', add: 1 }] }
      ], next: 'c2.interlude' },
      { id: 'c2.interlude', type: 'interlude', text: 'Between jobs.', events: ['c2.wake'], next: 'pool' },
      { id: 'c2.wake', type: 'event', title: 'The wake', options: [
        { id: 'pay', text: 'Pay the death benefits.', effects: [{ meter: 'htx', add: 1 }, { kUC: -1 }] },
        { id: 'refuse', text: 'Do not.', effects: [{ meter: 'htx', add: -1 }] }
      ] },
      { id: 'pool', type: 'pool', picks: 2, then: 'end' }
    ] },
    { id: 'f1', half: 2, thread: 'front', fallback: true, title: 'The Splinter Cell', nodes: [
      { id: 'f1.battle', type: 'battle', scenario: 'secure', enemy: { side: 'front', faction: 'rebel', core: ['rmilitia'] },
        on: { success: [{ effects: [{ meter: 'htx', add: 1 }], next: 'pool' }], failure: [{ effects: [{ meter: 'htx', add: -1 }], next: 'pool' }] } }
    ],
    passed: [{ meter: 'htx', add: -1 }] },
    { id: 'f2', half: 2, thread: 'front', when: { flag: 'dead' }, title: "Varga's Revenge", nodes: [
      { id: 'f2.ev', type: 'event', title: 'The challenge', options: [
        { id: 'meet', text: 'Meet them.', effects: [{ meter: 'hive', add: -1 }] },
        { id: 'ambush', text: 'Ambush them.', effects: [{ meter: 'hive', add: 1 }] }
      ], next: 'pool' }
    ] },
    { id: 'ffin', half: 2, thread: 'front', finale: true, title: 'The Last Redoubt', nodes: [
      { id: 'ffin.battle', type: 'battle', scenario: 'secure', enemy: { side: 'front', faction: 'rebel', core: ['rinsurgents'] },
        on: { success: [{ next: 'end' }], failure: [{ effects: [{ flag: 'lost_finale' }], next: 'end' }] } }
    ] },
    { id: 'h1', half: 2, thread: 'hive', fallback: true, title: 'The Shafts', nodes: [
      { id: 'h1.battle', type: 'battle', scenario: 'meeting', variant: { ambush: true }, enemy: { side: 'hive', faction: 'bugs', core: ['bsmall'] },
        on: { success: [{ next: 'pool' }], failure: [{ next: 'pool' }] } }
    ] },
    { id: 'hfin', half: 2, thread: 'hive', finale: true, title: 'Hive Heart', nodes: [
      { id: 'hfin.battle', type: 'battle', scenario: 'ce_clear', enemy: { side: 'hive', faction: 'bugs', core: ['battack'] },
        on: { success: [{ next: 'end' }], failure: [{ effects: [{ flag: 'lost_finale' }], next: 'end' }] } }
    ] },
    { id: 't1', half: 2, thread: 'truce', fallback: true, when: { flag: 'spared' }, title: 'The Ceasefire', nodes: [
      { id: 't1.terms', type: 'event', title: 'Terms', options: [
        { id: 'promise', text: 'Promise them the files.', effects: [{ meter: 'htx', add: -2 }] },
        { id: 'nothing', text: 'Promise nothing.', effects: [{ roll: { d6: 4 }, pass: [{ journal: 'They accept.' }], fail: [{ meter: 'htx', add: -1 }] }] }
      ], next: 'pool' }
    ] },
    { id: 'breakout', half: 2, title: 'Breakout', nodes: [
      { id: 'breakout.battle', type: 'battle', scenario: 'meeting',
        on: { success: [{ next: 'end' }], failure: [{ next: 'end' }] } }
    ] },
    { id: 'end', half: 2, counts: false, title: 'The end', nodes: [
      { id: 'end.node', type: 'ending' }
    ] }
  ],
  endings: [
    { id: 'broken', broken: true },
    { id: 'scorched', if: { meter: 'hive', gte: 8 } },
    { id: 'lost', if: { flag: 'lost_finale' } },
    { id: 'hero', if: { flag: 'held' } },
    { id: 'paid' }
  ]
});
