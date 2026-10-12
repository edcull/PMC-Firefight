/* PMC 2670 — Firefight : the star system a single-player campaign is fought
   across (roadmap v0.5; rules in rules/camp-system.js), in place of the plain
   list of offers. The system: the star, the planets on their orbits, each with
   its conditions, who holds it and how many contracts are on it. A planet: its
   map, with the contracts pinned where they are; a pin opens the offer, as the
   list has it, with Take this contract.

   Made once by dossier.js, the first time it is wanted. E is what it needs of
   dossier.js. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierSystem = function (E) {
    var C = E.C, R = E.R, esc = E.esc, ROMAN = E.ROMAN;
    var S = root.PMCSystem;
    var ui = { planet: null, offer: null };       // the planet chosen (or open), the offer open on its map
    var open = false;                            // the planet's map open, rather than the system

    // the look of each kind of world: the disc, and the ground of its map
    var LOOK = {
      desert: { base: '#c9955a', dark: '#7a4f2a', light: '#ecc58c', ground: ['#b9854c', '#a36f3c', '#d3a26a', '#8d5c31'] },
      arctic: { base: '#c7dbe6', dark: '#6f8ea3', light: '#f2f8fb', ground: ['#d6e5ee', '#b8ccd9', '#e8f1f6', '#9fb6c6'] },
      sparse: { base: '#7fa65a', dark: '#3e5a2c', light: '#b9d68f', ground: ['#86a862', '#729550', '#9bbd74', '#5f7f42'] },
      dense: { base: '#9a8f7c', dark: '#4a4338', light: '#d0c6b0', ground: ['#8f8673', '#7a7262', '#a59b86', '#665e50'] },
      industrial: { base: '#8a8f99', dark: '#3d4250', light: '#c4c9d2', ground: ['#7c818b', '#686d77', '#959aa3', '#555a64'] },
      jungle: { base: '#3f8a4f', dark: '#1d4a2a', light: '#7cc183', ground: ['#3c7f48', '#2f6a3b', '#4f9a5a', '#25522f'] },
      mountain: { base: '#8c8273', dark: '#45403a', light: '#cfc6b6', ground: ['#867c6c', '#706757', '#9c9282', '#5a5246'] },
      unstable: { base: '#a2483a', dark: '#4a1c18', light: '#f08a4a', ground: ['#8a3c30', '#6e2e25', '#b0503d', '#55221c'] }
    };
    var HAZE = { toxic: '#b6e36a', foggy: '#dfe8ef', foggytoxic: '#cfe39a', standard: '#9cc3ff' };
    function COLOURS() { return (root.PMCIso && root.PMCIso.COLOURS) || {}; }
    function inkOf(co) { var c = COLOURS()[co && E.colourOf(co)]; return c ? c.ink : '#93a1b5'; }
    function sys() { return E.camp && E.camp.system; }
    function offers() { return C.rollOffers(E.camp); }
    function rivals() { return E.camp.rivals && E.camp.rivals.length ? E.camp.rivals : [E.camp.companies.B]; }
    function offersOn(p) { return offers().map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return x.o.site && x.o.site.planet === p.id; }); }
    // the colour a share of influence is painted in: the company's own, a rival's, or grey for one gone
    function shareInk(k) {
      if (k === S.YOU) return inkOf(E.camp.companies.A);
      var co = rivals().filter(function (r) { return r.name === k; })[0];
      return co ? inkOf(co) : '#64728a';
    }
    function shareName(k) { return k === S.YOU ? E.camp.companies.A.name : k; }

    /* ---- the system ---- */
    function orbitR(p, n) { return 80 + (p.orbit - 1) * (238 / Math.max(1, n - 1)); }
    function at(p, n, cx, cy) {
      var a = p.angle * Math.PI / 180, r = orbitR(p, n);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.62 };
    }
    function systemSvg() {
      var s0 = sys(), n = s0.planets.length, W = 760, H = 520, cx = W / 2, cy = H / 2 + 6, rand = S.seeded(s0.seed ^ 0x5eed);
      var narrow = E.narrow ? E.narrow() : false, k = narrow ? 1.6 : 1;
      var vb = narrow ? '0 ' + (cy - 248) + ' ' + W + ' 496' : '0 0 ' + W + ' ' + H;
      var h = '<svg viewBox="' + vb + '" class="sys-svg' + (narrow ? ' narrow' : '') + '" role="img" aria-label="' + esc(s0.name) + ': ' + n + ' planets"><defs>' +
        '<radialGradient id="sys-star"><stop offset="0" stop-color="#fff7e0"/><stop offset=".35" stop-color="' + s0.star.colour + '"/><stop offset="1" stop-color="' + s0.star.colour + '" stop-opacity="0"/></radialGradient>';
      s0.planets.forEach(function (p) {
        var L = LOOK[p.kind] || LOOK.sparse, w = S.conditions(s0, p), hz = w.atmosphere === 'none' ? null : HAZE[w.atmosphere];
        h += '<radialGradient id="sys-g-' + p.id + '" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="' + L.light + '"/><stop offset=".45" stop-color="' + L.base + '"/><stop offset="1" stop-color="' + L.dark + '"/></radialGradient>';
        if (hz) h += '<radialGradient id="sys-h-' + p.id + '"><stop offset=".62" stop-color="' + hz + '" stop-opacity="0"/><stop offset=".8" stop-color="' + hz + '" stop-opacity="' + (w.atmosphere === 'standard' ? '.18' : '.45') + '"/><stop offset="1" stop-color="' + hz + '" stop-opacity="0"/></radialGradient>';
      });
      h += '</defs>';
      for (var i = 0; i < 140; i++) h += '<circle cx="' + (rand() * W).toFixed(1) + '" cy="' + (rand() * H).toFixed(1) + '" r="' + (rand() * 1.1 + 0.2).toFixed(2) + '" fill="#cfd8e6" opacity="' + (rand() * 0.5 + 0.15).toFixed(2) + '"/>';
      s0.planets.forEach(function (p) {
        var r = orbitR(p, n);
        h += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r.toFixed(1) + '" ry="' + (r * 0.62).toFixed(1) + '" fill="none" stroke="#3a4a63" stroke-opacity=".55" stroke-dasharray="2 5"/>';
      });
      h += '<circle cx="' + cx + '" cy="' + cy + '" r="58" fill="url(#sys-star)"/><circle cx="' + cx + '" cy="' + cy + '" r="17" fill="#fff3cf"/>' +
        '<text class="sys-lbl small" x="' + cx + '" y="' + (cy - 30) + '" text-anchor="middle">' + esc(s0.star.name) + '</text>';
      s0.planets.slice().sort(function (a, b) { return at(a, n, cx, cy).y - at(b, n, cx, cy).y; }).forEach(function (p) {
        var q = at(p, n, cx, cy), jobs = offersOn(p).length, pr = (11 + p.size * 7) * k, w = S.conditions(s0, p);
        var hz = w.atmosphere !== 'none', hold = S.holder(p), ev = S.activeEvents(s0, p).length;
        h += '<g class="sys-planet' + (jobs ? '' : ' dim') + (ui.planet === p.id ? ' sel' : '') + '" data-sys="planet" data-planet="' + p.id + '" tabindex="0" role="button" aria-label="' +
          esc(p.name + ', ' + S.KIND_NAMES[p.kind] + ', ' + jobs + ' contract' + (jobs === 1 ? '' : 's')) + '">' +
          (hz ? '<circle cx="' + q.x + '" cy="' + q.y + '" r="' + (pr * 1.75) + '" fill="url(#sys-h-' + p.id + ')"/>' : '') +
          // who holds it, as a ring in their colours
          (hold ? '<circle cx="' + q.x + '" cy="' + q.y + '" r="' + (pr + 3) + '" fill="none" stroke="' + shareInk(hold) + '" stroke-width="2" stroke-opacity=".85"/>' : '') +
          '<circle cx="' + q.x + '" cy="' + q.y + '" r="' + pr + '" fill="url(#sys-g-' + p.id + ')"/>' +
          '<circle class="ring" cx="' + q.x + '" cy="' + q.y + '" r="' + (pr + 7) + '" fill="none" stroke="#fff" stroke-opacity="0"/>' +
          '<path d="M' + q.x + ' ' + (q.y - pr) + ' a' + pr + ' ' + pr + ' 0 0 1 0 ' + (2 * pr) + ' a' + (pr * 0.55) + ' ' + pr + ' 0 0 0 0 ' + (-2 * pr) + 'z" fill="#05070b" opacity=".38" transform="rotate(' + (Math.atan2(q.y - cy, q.x - cx) * 180 / Math.PI).toFixed(1) + ' ' + q.x + ' ' + q.y + ')"/>' +
          '<text class="sys-lbl" x="' + q.x + '" y="' + (q.y + pr + 18 * k) + '" text-anchor="middle">' + esc(p.name) + (p.base ? ' ★' : '') + '</text>' +
          (jobs ? '<g class="sys-badge"><circle cx="' + (q.x + pr * 0.8) + '" cy="' + (q.y - pr * 0.8) + '" r="' + (9 * k) + '"/><text x="' + (q.x + pr * 0.8) + '" y="' + (q.y - pr * 0.8 + 4 * k) + '" text-anchor="middle">' + jobs + '</text></g>' : '') +
          (ev ? '<g class="sys-event"><circle cx="' + (q.x - pr * 0.8) + '" cy="' + (q.y - pr * 0.8) + '" r="' + (8 * k) + '"/><text x="' + (q.x - pr * 0.8) + '" y="' + (q.y - pr * 0.8 + 4 * k) + '" text-anchor="middle">!</text></g>' : '') +
          '</g>';
      });
      return h + '</svg>';
    }

    /* ---- a planet's map ---- */
    function blob(r, cx, cy, rad, pts) {
      var d = '';
      for (var i = 0; i < pts; i++) {
        var a = i / pts * Math.PI * 2, rr = rad * (0.65 + r() * 0.55);
        d += (i ? ' L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr * 0.8).toFixed(1);
      }
      return d + 'Z';
    }
    function mapSvg(p) {
      var s0 = sys(), W = 760, H = 520, L = LOOK[p.kind] || LOOK.sparse, r = S.seeded((s0.seed ^ (p.id.charCodeAt(1) * 2654435761)) >>> 0);
      var w = S.conditions(s0, p), hz = w.atmosphere !== 'none' && w.atmosphere !== 'standard' ? HAZE[w.atmosphere] : null;
      var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sys-svg sys-map" role="img" aria-label="Map of ' + esc(p.name) + '"><defs>' +
        '<filter id="sys-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>' +
        '<radialGradient id="sys-vig" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
        '<pattern id="sys-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#000" stroke-opacity=".12"/></pattern>' +
        (hz ? '<linearGradient id="sys-fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hz + '" stop-opacity=".28"/><stop offset=".5" stop-color="' + hz + '" stop-opacity=".06"/><stop offset="1" stop-color="' + hz + '" stop-opacity=".22"/></linearGradient>' : '') +
        '</defs><rect width="' + W + '" height="' + H + '" fill="' + L.ground[0] + '"/><g filter="url(#sys-soft)">';
      for (var i = 0; i < 26; i++) h += '<path d="' + blob(r, r() * W, r() * H, 40 + r() * 110, 9) + '" fill="' + L.ground[1 + (i % 3)] + '" opacity=".75"/>';
      h += '</g>';
      var j;
      if (p.kind === 'desert') for (j = 0; j < 7; j++) { var y0 = 30 + j * 75 + r() * 20; h += '<path d="M0 ' + y0 + ' Q 190 ' + (y0 - 30) + ' 380 ' + y0 + ' T 760 ' + y0 + '" fill="none" stroke="' + L.light + '" stroke-opacity=".35" stroke-width="3"/>'; }
      if (p.kind === 'arctic') for (j = 0; j < 4; j++) { var x0 = r() * W; h += '<path d="M' + x0 + ' 0 l' + (r() * 60 - 30) + ' 120 l' + (r() * 60 - 30) + ' 140 l' + (r() * 60 - 30) + ' 260" fill="none" stroke="#6f8ea3" stroke-width="3" stroke-opacity=".7"/>'; }
      if (p.kind === 'jungle') for (j = 0; j < 60; j++) h += '<circle cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * H).toFixed(0) + '" r="' + (6 + r() * 12).toFixed(0) + '" fill="#1d4a2a" opacity=".55"/>';
      if (p.kind === 'industrial' || p.kind === 'dense') for (j = 0; j < 30; j++) h += '<rect x="' + (r() * W).toFixed(0) + '" y="' + (r() * H).toFixed(0) + '" width="' + (14 + r() * 40).toFixed(0) + '" height="' + (10 + r() * 30).toFixed(0) + '" fill="' + (p.kind === 'dense' ? '#6a6252' : '#4b505b') + '" stroke="#2d313a" opacity=".85"/>';
      if (p.kind === 'unstable') for (j = 0; j < 5; j++) { var lx = r() * W, ly = r() * H; h += '<path d="' + blob(r, lx, ly, 30 + r() * 40, 8) + '" fill="#f08a4a" opacity=".55"/><path d="' + blob(r, lx, ly, 14 + r() * 14, 7) + '" fill="#ffd27a" opacity=".6"/>'; }
      if (p.kind === 'mountain') for (j = 0; j < 9; j++) { var mx = r() * W, my = r() * H, ms = 30 + r() * 50; h += '<path d="M' + (mx - ms) + ' ' + my + ' L' + mx + ' ' + (my - ms * 1.1) + ' L' + (mx + ms) + ' ' + my + 'Z" fill="#5a5246" opacity=".6"/><path d="M' + (mx - ms * 0.25) + ' ' + (my - ms * 0.8) + ' L' + mx + ' ' + (my - ms * 1.1) + ' L' + (mx + ms * 0.25) + ' ' + (my - ms * 0.8) + 'Z" fill="#e8ecef" opacity=".7"/>'; }
      if (p.kind === 'sparse') for (j = 0; j < 22; j++) h += '<circle cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * H).toFixed(0) + '" r="' + (8 + r() * 16).toFixed(0) + '" fill="#3e5a2c" opacity=".45"/>';
      h += '<path d="M -10 ' + (H * 0.7) + ' C ' + (W * 0.3) + ' ' + (H * 0.45) + ', ' + (W * 0.55) + ' ' + (H * 0.85) + ', ' + (W + 10) + ' ' + (H * 0.35) + '" fill="none" stroke="' + L.dark + '" stroke-opacity=".5" stroke-width="6"/>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#sys-grid)"/>' + (hz ? '<rect width="' + W + '" height="' + H + '" fill="url(#sys-fog)"/>' : '') +
        '<rect width="' + W + '" height="' + H + '" fill="url(#sys-vig)"/>' +
        '<text class="sys-lbl" x="22" y="34" style="font-size:18px">' + esc(p.name) + '</text>' +
        '<text class="sys-lbl small" x="22" y="52">' + esc(S.KIND_NAMES[p.kind]) + '</text>';
      offersOn(p).forEach(function (x) {
        var o = x.o, co = rivals()[o.rival] || E.camp.companies.B, px = o.site.x * W, py = o.site.y * H;
        var ce = /^ce_|^s_besieged/.test(o.scenario.id);
        h += '<g class="sys-pin' + (ui.offer === x.i ? ' sel' : '') + '" data-sys="offer" data-offer="' + x.i + '" tabindex="0" role="button" aria-label="' + esc(o.site.name + ': ' + o.scenario.name + ' against ' + co.name) + '">' +
          '<ellipse cx="' + px + '" cy="' + (py + 2) + '" rx="10" ry="4" fill="#000" opacity=".35"/>' +
          '<path class="pinhead" d="M' + px + ' ' + py + ' c -11 -14 -15 -20 -15 -28 a15 15 0 1 1 30 0 c0 8 -4 14 -15 28z" fill="' + inkOf(co) + '" stroke="#0d1117" stroke-width="2"/>' +
          '<text class="sys-pintier" x="' + px + '" y="' + (py - 24) + '" text-anchor="middle">' + (ce ? 'CE' : ROMAN[o.tier]) + '</text>' +
          '<text class="sys-lbl" x="' + px + '" y="' + (py + 18) + '" text-anchor="middle">' + esc(o.site.name) + '</text>' +
          '<text class="sys-lbl small" x="' + px + '" y="' + (py + 32) + '" text-anchor="middle">' + esc(o.scenario.name) + '</text></g>';
      });
      return h + '</svg>';
    }

    /* ---- the card beside the drawing ---- */
    function condPills(p) {
      var lines = R.worldLines(S.conditions(sys(), p));
      if (!lines.length) return '<div class="sys-pills"><span class="mk worldpill">Conditions much like home</span></div>';
      return '<div class="sys-pills">' + lines.map(function (x) { return '<span class="mk worldpill" title="' + esc(x.text) + '">' + esc(x.name) + '</span>'; }).join('') + '</div>' +
        lines.map(function (x) { return '<p class="sys-cond"><b>' + esc(x.name) + ':</b> ' + esc(x.text) + '</p>'; }).join('');
    }
    // the shares of influence, as a bar, and who holds it
    function shares(p) {
      var inf = p.influence, keys = Object.keys(inf).filter(function (k) { return inf[k] > 0; }).sort(function (a, b) { return inf[b] - inf[a]; });
      var free = 100 - keys.reduce(function (a, k) { return a + inf[k]; }, 0), hold = S.holder(p), st = S.standing(sys(), p);
      return '<div class="sys-bar" role="img" aria-label="Influence on ' + esc(p.name) + '">' + keys.map(function (k) {
        return '<span style="width:' + inf[k] + '%;background:' + shareInk(k) + '" title="' + esc(shareName(k) + ': ' + inf[k]) + '"></span>';
      }).join('') + (free > 0 ? '<span class="free" style="width:' + free + '%" title="Unaligned: ' + free + '"></span>' : '') + '</div>' +
        '<div class="sys-hold">' + (hold ? 'Held by <b>' + esc(shareName(hold)) + '</b>' : 'Contested') + ' · your standing ' + st + ' (' + esc(S.standingName(st)) + ')' +
        (p.home ? ' · home of ' + esc(p.home) : '') + (p.base ? ' · your base' : '') + '</div>';
    }
    function events(p) {
      return S.activeEvents(sys(), p).map(function (e) {
        return '<p class="sys-ev"><b>' + esc(e.title) + '</b> — ' + esc(e.text) + ' (to the end of turn ' + (e.until + 1) + ')</p>';
      }).join('');
    }
    function jobList(p) {
      var os = offersOn(p);
      if (!os.length) return '<p class="dnote">No contracts here this turn.</p>';
      return '<ul class="sys-jobs">' + os.map(function (x) {
        var o = x.o, co = rivals()[o.rival] || E.camp.companies.B;
        return '<li><button type="button" data-sys="offer" data-offer="' + x.i + '"' + (ui.offer === x.i ? ' class="on"' : '') + '><span class="sw" style="background:' + inkOf(co) + '"></span>' +
          '<span><b>' + esc(o.scenario.name) + '</b><small>' + esc(co.name) + ' · ' + esc(o.site.name) + '</small></span><span class="t">Tier ' + ROMAN[o.tier] + '</span></button></li>';
      }).join('') + '</ul>';
    }
    function systemCard() {
      var s0 = sys(), p = ui.planet && S.byId(s0, ui.planet);
      if (!p) {
        var news = (s0.news || []).slice(-4).reverse();
        return '<h3 class="sys-h">' + esc(s0.name) + '</h3><div class="dnote">' + s0.planets.length + ' planets around ' + esc(s0.star.name) + ' · ' + offers().length + ' contracts this turn</div>' +
          '<h4>Planets</h4><ul class="sys-jobs">' + s0.planets.map(function (q) {
            var n = offersOn(q).length, lines = R.worldLines(S.conditions(s0, q)), hold = S.holder(q);
            return '<li><button type="button" data-sys="planet" data-planet="' + q.id + '"><span class="sw" style="background:' + (LOOK[q.kind] || LOOK.sparse).base + '"></span><span><b>' + esc(q.name) + '</b><small>' +
              esc(S.KIND_NAMES[q.kind]) + (lines.length ? ' · ' + esc(lines.map(function (x) { return x.name; }).join(', ')) : ' · much like home') +
              (hold ? ' · held by ' + esc(shareName(hold)) : '') + '</small></span><span class="t">' + n + '</span></button></li>';
          }).join('') + '</ul>' +
          (news.length ? '<h4>News</h4>' + news.map(function (x) { return '<p class="sys-ev">Turn ' + (x.turn + 1) + ': ' + esc(x.text) + '</p>'; }).join('') : '');
      }
      return '<h3 class="sys-h">' + esc(p.name) + '</h3><div class="dnote">' + esc(S.KIND_NAMES[p.kind]) + '</div>' + condPills(p) + events(p) + shares(p) +
        '<h4>Contracts here</h4>' + jobList(p) +
        (offersOn(p).length ? '<button type="button" class="start" data-sys="land" data-planet="' + p.id + '">Land on ' + esc(p.name) + '</button>' : '');
    }
    function planetCard(p) {
      if (ui.offer != null && offers()[ui.offer]) return E.offerPanel(offers()[ui.offer], ui.offer);
      return '<h3 class="sys-h">' + esc(p.name) + '</h3><div class="dnote">' + esc(S.KIND_NAMES[p.kind]) + '</div>' + condPills(p) + events(p) + shares(p) + '<h4>Contracts here</h4>' + jobList(p);
    }

    function view() {
      var s0 = sys();
      if (!s0) return E.listView();
      var p = open && ui.planet && S.byId(s0, ui.planet);
      if (open && !p) open = false;
      var head = '<div class="sys-head"><h2>' + esc(p ? p.name : s0.name) + '</h2>' +
        '<span class="sys-crumb">' + (p ? esc(s0.name) + ' · ' + offersOn(p).length + ' contracts' : 'Turn ' + (E.camp.turn + 1) + ' · ' + offers().length + ' contracts on offer') + '</span>' +
        (p ? '<button type="button" class="lnk" data-sys="back">← The system</button>' : '') +
        '<button type="button" class="lnk" data-go="offerlist">List</button><button type="button" class="lnk" data-go="hub">← Hub</button></div>';
      return head + '<div class="sys-stage"><div class="sys-view' + (p ? ' zoomin' : '') + '">' + (p ? mapSvg(p) : systemSvg()) +
        '<div class="sys-hint">' + (p ? 'Tap a pin for the job.' : 'Tap a planet for its conditions and contracts.') + '</div></div>' +
        '<aside class="cpan sys-card">' + (p ? planetCard(p) : systemCard()) + '</aside></div>';
    }
    // a tap on the system's parts; true if it was one
    function act(t) {
      var what = t.getAttribute('data-sys'), pl = t.getAttribute('data-planet'), of = t.getAttribute('data-offer');
      if (what === 'back') { open = false; ui.offer = null; return true; }
      if (what === 'land') { ui.planet = pl; open = true; ui.offer = null; return true; }
      if (what === 'planet') {
        // a second tap on the chosen planet lands on it
        if (!open && ui.planet === pl && offersOn(S.byId(sys(), pl)).length) { open = true; ui.offer = null; }
        else ui.planet = pl;
        return true;
      }
      if (what === 'offer') {
        var o = offers()[+of];
        if (!o || !o.site) return true;
        ui.planet = o.site.planet; open = true; ui.offer = +of;
        return true;
      }
      return false;
    }
    function reset() { ui.planet = null; ui.offer = null; open = false; }
    return { view: view, act: act, reset: reset, isOpen: function () { return open; } };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierSystem;
})(typeof window !== 'undefined' ? window : global);
