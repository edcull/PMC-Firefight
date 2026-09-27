/* PMC 2670 — Firefight : the ways in: the entry points the other screens use (PMC_*).
   The hooks the tests drive the board through (__*) are in testhooks.js, which
   the published builds leave out.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   read through B as it is now. */
(function (root) {
  'use strict';
  root.PMCHooks = function (B) {
    var begin = B.begin, joinBattle = B.joinBattle, wireNet = B.wireNet, ISO = B.ISO, el = B.el;
    // from modules installed after this one: looked up when called
    function drawColourPick() { return B.drawColourPick.apply(this, arguments); }
    function drawMuster() { return B.drawMuster.apply(this, arguments); }
    function hotBegin() { return B.hotBegin.apply(this, arguments); }
    function hotEnd() { return B.hotEnd.apply(this, arguments); }
    function hotPaint() { return B.hotPaint.apply(this, arguments); }
    function musterFaction() { return B.musterFaction.apply(this, arguments); }
    function musterTactic() { return B.musterTactic.apply(this, arguments); }
    function setSoloMode() { return B.setSoloMode.apply(this, arguments); }

    /* ---- the ways in ----
       Four screens start a battle — the muster screen, solitaire, a campaign
       contract and a room in the lobby — and all four arrive here. The first
       three run the engine in this tab; the fourth is already running on a
       server and only hands over the seat. */
    window.PMC_JOIN_BATTLE = function (transport, seat, cfg) {
      var setup = el('setup');
      if (setup) setup.hidden = true;
      if (window.PMCMenu) window.PMCMenu.close();
      if (cfg && cfg.colourA) ISO.setSideColour('A', cfg.colourA);
      if (cfg && cfg.colourB) ISO.setSideColour('B', cfg.colourB);
      // the same connection comes back here on every rejoin: its handlers go on once
      if (!transport.__board) { wireNet(transport); transport.__board = true; }
      joinBattle(transport, seat);
      transport.send('resync');
    };
    /* The lobby borrows the muster screen to build a force: it is the one place
       that knows the composition table and the unit cards. */
    window.PMC_MUSTER_FOR = function (terms, done, have, room) {
      hotEnd();
      el('setup').hidden = false;
      B.muster.forLobby = { terms: terms, done: done, room: room || '' };
      setSoloMode(false);
      if (terms) {
        if (el('sel-tier')) el('sel-tier').value = terms.tier;
        if (el('sel-pl')) el('sel-pl').value = terms.pl;
      }
      hotBegin('net');
      // the force already sent to the room, to change rather than start again
      if (have && have.keys && have.keys.length) {
        el('sel-faction').value = have.faction || 'pmc';
        if (el('sel-tactic')) el('sel-tactic').value = have.tactic || '';
        B.muster.keys = have.keys.slice();
        B.muster.colour = have.colour || B.muster.colour;
        B.muster.name = have.name || B.muster.name;
        if (el('hot-name')) el('hot-name').value = B.muster.name;
        drawColourPick();
      }
      hotPaint();
      drawMuster();
    };
    window.PMC_MUSTER_NOW = function () {
      return {
        faction: musterFaction(), tactic: musterTactic() || '',
        keys: B.muster.keys.slice(), colour: B.muster.colour || 'ochre',
        name: B.muster.name || ''
      };
    };
    /* The campaign layer starts a battle through here rather than through the
       muster screen: the same config, plus the dossier entries and the doctrines. */
    window.PMC_NEWGAME = function (cfg) {
      var setup = el('setup');
      if (setup) setup.hidden = true;
      begin(cfg);
    };
  };
})(window);
