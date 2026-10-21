/* PMC 2670 — Firefight : the OpFor thinking ahead, off the page.

   A battle in this browser (net.js Local) owes the OpFor's answer to what the
   player just did. Before the page gives it, it hands this worker the battle
   as the save writes it and where its dice are; the worker plays the same
   answer out in a copy of its own, and sends back what the costly part of the
   thinking came to — the worth of every option the lookahead played out, and
   the exposure grids (ai.js ahead). The page then gives the answer itself, the
   whole of it, with that already to hand: the same answer, without the page
   standing still while it is thought out. Whatever the page asks for that is
   not in what came back, it works out itself, as it always has. */
(function () {
  'use strict';
  self.window = self;                                // the rules hang what they are on `window`
  // the page's build, so a worker is never made of another build's scripts (net.js aiWorker)
  var v = /[?&]v=([^&]+)/.exec(self.location.search), q = v ? '?v=' + v[1] : '';
  importScripts('files.js' + q);
  importScripts.apply(null, self.PMC_ENGINE_FILES.map(function (f) { return '../../' + f + q; }));

  // the battle's dice, carried on from where the page's are (net.js dice: the same mulberry32)
  function dice(at) {
    var a = at >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // loaded: the page asks it from now on (net.js aiWorker)
  self.postMessage({ ready: true });

  self.onmessage = function (m) {
    var d = m.data || {}, A = self.PMCEngineAI.ahead, real = Math.random;
    try {
      var e = self.PMCEngine.create();
      e.load(JSON.parse(d.snap));
      A.begin();
      Math.random = dice(d.rng);
      try { e.aiNow(); } finally { Math.random = real; }
      self.postMessage({ id: d.id, ok: true, got: A.take() });
    } catch (err) {
      A.take();
      self.postMessage({ id: d.id, ok: false, why: String((err && err.message) || err) });
    }
  };
})();
