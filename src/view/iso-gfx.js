/* PMC 2670 — Firefight : the graphics setting.

   Low graphics, for a phone that struggles: the board is drawn at one pixel per
   CSS pixel, the heat haze is left off, and nothing on the table moves by
   itself between actions — no flags flying, smoke drifting, flames licking,
   rotors turning or lights flashing. Every idle animation reads the time from
   idleNow() rather than the clock, and in low graphics that time stands still,
   so each is drawn as a still frame. Moves, shots and the effects of the
   battle itself play as always. */
(function (root) {
  'use strict';
  var low = false;
  try { low = localStorage.getItem('pmc-lowgfx') === '1'; } catch (e) { }
  var subs = [];
  root.PMCGfx = {
    low: function () { return low; },
    setLow: function (v) {
      low = !!v;
      try { localStorage.setItem('pmc-lowgfx', low ? '1' : '0'); } catch (e) { }
      subs.forEach(function (f) { f(low); });
    },
    // told whenever the setting changes (the board resizes its buffer, repaints)
    onChange: function (f) { subs.push(f); },
    // the time an idle animation is drawn at: the clock, or a still frame
    idleNow: function () { return low ? 0 : (root.performance ? performance.now() : 0); }
  };
})(window);
