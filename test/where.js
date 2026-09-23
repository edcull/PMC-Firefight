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

/* The game opens on its main menu now, with the muster screen hidden behind
   it. The tests that start a battle from the muster screen want the plain
   single screen they were written against — pick a force, a mode, Take the
   field — so this puts the menu away and shows the muster, the way the
   lobby's borrowed muster does, rather than walking the menu's stepped
   set-ups. */
async function openMuster(page) {
  await page.evaluate(() => {
    if (window.PMCMenu) window.PMCMenu.close();
    const s = document.getElementById('setup');
    if (s) s.hidden = false;
  });
  await page.waitForTimeout(150);
}

module.exports = {
  openMuster: openMuster,
  ROOT: ROOT,
  SHOTS: SHOTS,
  page: path.join(ROOT, 'index.html'),
  viewer: path.join(ROOT, 'viewer.html'),
  shot: function (name) {
    fs.mkdirSync(SHOTS, { recursive: true });
    return path.join(SHOTS, name);
  }
};
