/* PMC 2670 — Firefight : the scripts the rules and the engine are made of, in
   the order they are loaded, without the board: what the server runs
   (server/rules.js) and what the page thinks ahead in, off the page
   (aiworker.js). Paths from the top of the repository. */
(function (root) {
  'use strict';
  root.PMC_ENGINE_FILES = [
    'src/rules/data.js', 'src/rules/move.js', 'src/rules/assault.js', 'src/rules/shoot.js', 'src/rules/xeno.js', 'src/rules/destruct.js', 'src/rules/damage.js', 'src/rules/space.js', 'src/rules/rules.js', 'src/rules/camp-company.js', 'src/rules/camp-contract.js', 'src/rules/camp-aftermath.js', 'src/rules/camp-rivals.js', 'src/rules/campaign.js', 'src/rules/camp-system.js', 'src/rules/scenarios.js', 'src/rules/battlestats.js', 'src/rules/battletrack.js',
    'src/rules/solitaire.js', 'src/rules/gen.js', 'src/rules/compound.js', 'src/engine/ai.js', 'src/engine/planner.js', 'src/engine/offtable.js', 'src/engine/save.js', 'src/engine/marks.js', 'src/engine/combat.js', 'src/engine/counters.js', 'src/engine/abilities.js', 'src/engine/moves.js', 'src/engine/actions.js', 'src/engine/endphase.js', 'src/engine/solo.js', 'src/engine/arrivals.js', 'src/engine/deploy.js', 'src/engine/terrainsetup.js', 'src/engine/swaps.js', 'src/engine/storybattle.js', 'src/engine/protocol.js', 'src/engine/engine.js'
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMC_ENGINE_FILES;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : global);
