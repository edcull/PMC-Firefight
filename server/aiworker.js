/* The OpFor thinking ahead, off the server's event loop: one worker thread of
   the pool (aipool.js).

   A table (table.js thinkAhead) hands it the battle as the save writes it and
   where its dice are; it plays the same answer out in a copy of its own and
   sends back what the costly part of the thinking came to (ai.js ahead), which
   the table then gives the answer with. As the page's worker does
   (src/engine/aiworker.js). */
'use strict';
const { parentPort } = require('worker_threads');
const { Engine } = require('./rules.js');

// the battle's dice, carried on from where the table's are (table.js dice: the same mulberry32)
function dice(at) {
  let a = at >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

parentPort.on('message', (d) => {
  const A = global.PMCEngineAI.ahead, real = Math.random;
  try {
    const e = Engine.create();
    e.load(JSON.parse(d.snap));
    A.begin();
    Math.random = dice(d.rng);
    try { e.aiNow(); } finally { Math.random = real; }
    parentPort.postMessage({ id: d.id, ok: true, got: A.take() });
  } catch (err) {
    A.take();
    parentPort.postMessage({ id: d.id, ok: false, why: String((err && err.message) || err) });
  }
});
