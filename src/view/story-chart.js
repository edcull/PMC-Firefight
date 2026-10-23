/* PMC 2670 — Firefight : the star chart (docs/story-dead-reckoning-plan.md, phase 4)

   For a story that follows a trail across the stars (`chart`, as Dead Reckoning
   has): the stops the company has made, joined in order across a field of
   stars, where it is now, the next heading as far as the log has given it,
   where each rival was last met and how strong it is, and the lodestones on
   each side. Worked out by story.js `chart` from the story's state alone, and
   drawn here as an SVG of square pixels, in the scenes' manner. */
(function (root) {
  'use strict';
  var W = 160, H = 64;

  function esc(t) { return root.PMC && root.PMC.esc ? root.PMC.esc(t) : String(t == null ? '' : t); }
  // the same stars every time, from the story's name
  function rng(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return function () { h = (h + 0x6D2B79F5) | 0; var t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  var KIND = { dense: '#7ab07a', desert: '#d8b070', arctic: '#c8dcf0', jungle: '#4aa070', industrial: '#a0a0b0', unstable: '#d07040', sparse: '#90b070', mountain: '#a09080' };
  var RIVAL = { kettle: '#c9a65a', wraith: '#6a8aa0', sable: '#8a9a7a', kestrel: '#7fb3d9', reavers: '#b04a3a', lance: '#9a7ac8' };

  /* `c` (story.js chart): { stops, here, ahead, rivals, stones, theirs }. */
  function svg(c, seed) {
    var r = rng(seed || 'chart'), out = '';
    function px(x, y, col, w, h) { out += '<rect x="' + Math.round(x) + '" y="' + Math.round(y) + '" width="' + (w || 1) + '" height="' + (h || 1) + '" fill="' + col + '"/>'; }
    px(0, 0, '#05060e', W, H);
    for (var k = 0; k < 90; k++) px(r() * W, r() * H, r() < 0.15 ? '#ffffff' : r() < 0.5 ? '#7a84a8' : '#3a4468');
    var n = c.stops.length + (c.ahead ? 1 : 0), gap = Math.min(30, (W - 24) / Math.max(1, n - 1));
    var pts = [];
    for (var i = 0; i < n; i++) pts.push({ x: 12 + i * gap, y: 30 + Math.round(Math.sin(i * 1.7) * 9) });
    // the route: a dotted line from stop to stop, faint towards the heading ahead
    for (var s = 0; s + 1 < pts.length; s++) {
      var a = pts[s], b = pts[s + 1], steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (var t = 0; t <= steps; t += 2) px(a.x + (b.x - a.x) * t / steps, a.y + (b.y - a.y) * t / steps, s + 1 === c.stops.length ? '#4a5478' : '#c8b878');
    }
    c.stops.forEach(function (st, i) {
      var p = pts[i], col = KIND[st.kind] || '#c8c8c8', here = st.key === c.here;
      if (here) { px(p.x - 4, p.y - 4, '#e8c25a', 9, 1); px(p.x - 4, p.y + 4, '#e8c25a', 9, 1); px(p.x - 4, p.y - 4, '#e8c25a', 1, 9); px(p.x + 4, p.y - 4, '#e8c25a', 1, 9); }
      px(p.x - 2, p.y - 1, col, 5, 3); px(p.x - 1, p.y - 2, col, 3, 5); px(p.x - 1, p.y - 1, '#ffffff', 1, 1);
      // the rivals last met here, a pip each in their colours, under the stop
      c.rivals.filter(function (rv) { return rv.at === st.key; }).forEach(function (rv, j) { px(p.x - 3 + j * 3, p.y + 7, RIVAL[rv.id] || '#c8c8c8', 2, 2); });
    });
    if (c.ahead) { var q = pts[pts.length - 1]; px(q.x - 1, q.y - 3, '#4a5478', 3, 1); px(q.x + 1, q.y - 2, '#4a5478', 1, 2); px(q.x, q.y, '#4a5478', 1, 1); px(q.x, q.y + 2, '#4a5478', 1, 1); }
    // the lodestones: the company's along the bottom left, the rivals' (if known) at the right
    for (var g = 0; g < 7; g++) px(6 + g * 6, H - 8, g < c.stones ? '#7ae0c8' : '#1a2a3a', 4, 4);
    if (c.theirs != null) for (var h = 0; h < 7; h++) px(W - 48 + h * 6, H - 8, h < c.theirs ? '#d0503c' : '#2a1a1a', 4, 4);
    return '<svg class="story-chart-map" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + out + '</svg>';
  }

  // the chart as the page shows it: the map, then the stops and the rivals in words
  function html(c, seed) {
    if (!c) return '';
    var h = '<div class="story-chart"><small>The star chart</small>' + svg(c, seed) + '<ol class="chart-stops">';
    c.stops.forEach(function (st) {
      var met = c.rivals.filter(function (rv) { return rv.at === st.key; }).map(function (rv) { return rv.name; });
      h += '<li' + (st.key === c.here ? ' class="here"' : '') + '><b>' + esc(st.planet || st.system || '?') + '</b>' + (st.system && st.planet ? ' <small>' + esc(st.system) + '</small>' : '') +
        (st.site ? ' · ' + esc(st.site) : '') + (met.length ? ' <small class="met">met ' + esc(met.join(', ')) + '</small>' : '') + '</li>';
    });
    if (c.ahead) h += '<li class="ahead"><b>?</b> <small>' + esc(c.ahead) + '</small></li>';
    h += '</ol><p class="chart-stones"><b>Lodestones</b> ' + c.stones + ' held' + (c.theirs != null ? ' · the rivals hold ' + c.theirs : ' · the rivals’ count unknown') + '</p>';
    // the rivals met (or leading, or whose client is known), and who each works for, if anyone has found out
    var known = c.rivals.filter(function (rv) { return rv.at || rv.leading || rv.client; });
    if (known.length) h += '<p class="chart-rivals">' + known.map(function (rv) {
      return '<span><i style="background:' + (RIVAL[rv.id] || '#c8c8c8') + '"></i>' + esc(rv.name) + (rv.leading ? ' (leading)' : '') +
        (rv.client ? ' <small>for ' + esc(rv.client) + '</small>' : rv.client === false ? ' <small class="secret">client unknown</small>' : '') + '</span>';
    }).join('') + '</p>';
    return h + '</div>';
  }

  root.PMCStoryChart = { svg: svg, html: html, W: W, H: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryChart;
})(typeof window !== 'undefined' ? window : global);
