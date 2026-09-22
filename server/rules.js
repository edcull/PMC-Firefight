/* Load the game's own modules under node.

   rules.js and everything beside it were written for a browser and hang their
   exports on `window`; the test suite has always run them by pointing `window`
   at `global` first, and so does the server. Nothing in these files touches the
   DOM — the drawing lives in iso.js and fx.js, which are not loaded here. */
'use strict';
const path = require('path');

if (!global.window) global.window = global;

const ROOT = path.join(__dirname, '..');
[
  'src/rules/rules.js', 'src/rules/campaign.js', 'src/rules/scenarios.js',
  'src/rules/solitaire.js', 'src/rules/gen.js', 'src/engine/engine.js'
]
  .forEach((f) => require(path.join(ROOT, f)));

module.exports = {
  R: global.PMC,
  SC: global.PMCScen,
  GEN: global.PMCGen,
  C: global.PMCCamp,
  SOLO: global.PMCSolo,
  Engine: global.PMCEngine
};
