/* Where things are, seen from inside test/.

   The tests sit two levels down from the page they drive and the modules they
   load, and a handful of them take screenshots. Both facts are written here
   once rather than in fifty files, so moving anything again is one edit. */
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
/* Screenshots used to land in the project root, among the source. They are
   something to look at rather than something to keep, so they go where the
   rest of the generated things go. */
const SHOTS = path.join(ROOT, 'build', 'shots');

/* A skirmish started the way the old one-screen muster started one: your
   units if they make a legal army (else a rolled one), an opposition rolled
   (or your own list mirrored), the scenario rolled unless one is named, and
   the Tier, Priority Level, planet and terrain from the setup screen's own
   selects unless given. The menu's skirmishes go through the step-by-step
   muster now; this is for tests that just want a battle with these units. */
async function startSkirmish(page, o) {
  await page.evaluate((o) => {
    if (window.PMCMenu) window.PMCMenu.close();
    const R = window.PMC, SC = window.PMCScen, val = (id) => (document.getElementById(id) || {}).value;
    const tier = +(o.tier || val('sel-tier') || 3), pl = +(o.pl || val('sel-pl') || 1), faction = o.faction || 'pmc';
    let mine = (o.keys || []).slice();
    if (!R.checkArmy(mine, tier, pl, null, null, faction).ok) mine = R.rollArmy(tier, pl, null, faction);
    const theirs = o.mirror ? mine.slice() : R.rollArmy(tier, pl, null, o.opFaction || 'pmc');
    let scen = o.scenario || val('sel-scen') || 'roll';
    if (scen === 'roll') scen = SC.ORDER[R.d6() - 1];
    else if (scen === 'rolld3') scen = SC.ORDER[R.d3() - 1];
    window.PMC_NEWGAME({
      tier: tier, pl: pl, scenario: scen, armyA: mine, armyB: theirs,
      nameA: 'Test force', nameB: o.mirror ? 'Mirror force' : 'OpFor company',
      mode: o.mode || 'ai', planet: o.planet || val('sel-planet') || 'sparse',
      terrainSetup: o.terrain || val('sel-terrain') || 'auto'
    });
  }, o || {});
}

module.exports = {
  startSkirmish: startSkirmish,
  ROOT: ROOT,
  SHOTS: SHOTS,
  page: path.join(ROOT, 'index.html'),
  viewer: path.join(ROOT, 'viewer.html'),
  shot: function (name) {
    fs.mkdirSync(SHOTS, { recursive: true });
    return path.join(SHOTS, name);
  }
};
