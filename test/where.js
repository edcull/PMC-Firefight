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
   (insurgents against mercenaries, mercenaries against anyone else — or your
   own list mirrored), the scenario rolled unless one is named, and
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
    // the old sheet's Opposition default: mercenaries draw insurgents, anyone else mercenaries
    const opFaction = o.mirror ? faction : o.opFaction || (faction === 'pmc' ? 'rebel' : 'pmc');
    const theirs = o.mirror ? mine.slice() : R.rollArmy(tier, pl, null, opFaction);
    // an insurgent opposition picks a tactic of its own, the way a player would
    const opTactic = opFaction === 'rebel' && !o.mirror ? R.TACTICS[Math.floor(Math.random() * R.TACTICS.length)].id : null;
    let scen = o.scenario || val('sel-scen') || 'roll';
    if (scen === 'roll') scen = SC.ORDER[R.d6() - 1];
    else if (scen === 'rolld3') scen = SC.ORDER[R.d3() - 1];
    window.PMC_NEWGAME({
      tier: tier, pl: pl, scenario: scen, armyA: mine, armyB: theirs,
      nameA: 'Test force', nameB: o.mirror ? 'Mirror force' : opFaction === 'rebel' ? 'Insurgent group' : 'OpFor company',
      colourA: 'ochre', tactics: { A: null, B: opTactic },
      mode: o.mode || 'ai', planet: o.planet || val('sel-planet') || 'sparse',
      terrainSetup: o.terrain || val('sel-terrain') || 'auto'
    });
  }, o || {});
}

/* Seeded dice for a page, before anything on it loads: a test whose checks ride on
   how a random battle goes (who fires first, how much experience is earned) is
   then the same battle every run. The clock is left alone; only the dice are fixed. */
async function seedDice(page, seed) {
  await page.addInitScript((s0) => {
    let s = s0 >>> 0 || 1;
    Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }, seed);
}

/* Into the multiplayer lobby the way a player goes: open it, and through the
   sign-in screen — a new account ('register', the default), an existing one
   ('signin'), or a guest. Resolves once the lobby has welcomed them. */
async function signInLobby(page, name, mode, password) {
  mode = mode || 'register';
  await page.evaluate(() => window.PMCLobby.open());
  await page.waitForFunction(() => !!document.getElementById('sign-name') || !!(window.PMCLobby.net() && window.PMCLobby.net().live), null, { timeout: 8000 });
  if (await page.evaluate(() => !!document.getElementById('sign-name'))) {
    await page.evaluate((m) => document.querySelector('#lobby [data-lob="signmode"][data-mode="' + m + '"]').click(), mode);
    await page.fill('#sign-name', name);
    if (mode !== 'guest') await page.fill('#sign-pass', password || 'password for ' + name);
    await page.evaluate(() => document.querySelector('#lobby [data-lob="signgo"]').click());
  }
  await page.waitForFunction(() => !!(window.PMCLobby.net() && window.PMCLobby.net().live) && !document.getElementById('sign-name'), null, { timeout: 8000 });
}
// a data directory of its own for a test's server: a fresh database every run
function tmpData() { return fs.mkdtempSync(path.join(require('os').tmpdir(), 'pmc-data-')); }

module.exports = {
  signInLobby: signInLobby,
  tmpData: tmpData,
  startSkirmish: startSkirmish,
  seedDice: seedDice,
  ROOT: ROOT,
  SHOTS: SHOTS,
  page: path.join(ROOT, 'index.html'),
  viewer: path.join(ROOT, 'viewer.html'),
  shot: function (name) {
    fs.mkdirSync(SHOTS, { recursive: true });
    return path.join(SHOTS, name);
  }
};
