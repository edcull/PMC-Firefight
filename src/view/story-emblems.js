/* PMC 2670 — Firefight : the story's people as emblems (docs/story-mode-plan.md, phase 7)

   A story names who an event is about (`who` on the node, a key of the story's
   `people`); each person or side carries a mark and an ink, and the event shows
   it as a round badge with their name and what they are. Plain line drawings on
   a 24-unit grid, drawn in the ink: no pictures to load, and they read at any
   size, in either theme. */
(function (root) {
  'use strict';

  var MARKS = {
    // a miner's helmet, its lamp lit
    lamp: '<path d="M5 15a7 7 0 0 1 14 0z"/><path d="M3.5 15h17"/><circle cx="12" cy="10.5" r="1.6"/><path d="M12 6.5V4M9 7.4L7.6 5.6M15 7.4l1.4-1.8"/>',
    // a star, the Front's
    star: '<path d="M12 3.5l2.4 5.1 5.6.7-4.1 3.8 1.1 5.5L12 15.9l-5 2.7 1.1-5.5L4 9.3l5.6-.7z"/>',
    // the starport's control tower
    tower: '<path d="M10.5 20.5V10h3v10.5"/><path d="M7.5 10h9l-1.2-3.5H8.7z"/><path d="M12 6.5V3.5"/><path d="M8.5 20.5h7"/>',
    // an ore truck
    truck: '<path d="M3 16V9h10v7"/><path d="M13 11h4l3 3v2h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
    // HTX: a hexagon with its H
    htx: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M9.5 8.5v7M14.5 8.5v7M9.5 12h5"/>',
    // Black Lantern's lantern
    lantern: '<path d="M9.5 5h5"/><path d="M10.5 5V3.5h3V5"/><path d="M8 7h8l-1 11H9z"/><path d="M12 10v5"/><path d="M7 20.5h10"/>',
    // a schoolbook, open
    book: '<path d="M4 6.5c3-1 6-1 8 1 2-2 5-2 8-1v11.5c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 7.5V19"/>',
    // a pick, the miners' guild
    pick: '<path d="M6 19.5L15 10.5"/><path d="M8.5 6c4-1.5 8 .5 10.5 4.5-3-2-6-2.8-10.5-2.2z"/>',
    // the hive: three cells
    hive: '<path d="M8 4.5l3 1.7v3.6L8 11.5 5 9.8V6.2z"/><path d="M16 4.5l3 1.7v3.6l-3 1.7-3-1.7V6.2z"/><path d="M12 11.5l3 1.7v3.6l-3 1.7-3-1.7v-3.6z"/>',
    // a shield, for anyone without a mark of their own
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>'
  };

  // the badge: a ring in the ink, the mark drawn in it
  function badge(mark, ink, size) {
    var s = size || 40, k = MARKS[mark] || MARKS.shield, c = ink || '#c9a24a';
    return '<svg class="story-emblem" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle cx="16" cy="16" r="14.5" fill="rgba(8,10,14,.55)" stroke="' + c + '" stroke-width="1.5"/>' +
      '<g transform="translate(4 4)" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + k + '</g></svg>';
  }

  root.PMCStoryEmblems = { MARKS: MARKS, badge: badge };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryEmblems;
})(typeof window !== 'undefined' ? window : global);
