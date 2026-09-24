/* PMC 2670 — the Unit Atlas.

   Every profile in the four army lists, drawn by the game's own renderer:
   squads in each state, machines at every facing on every propulsion, wrecks.
   Pick a company colour and turn on the states, facings, movement types and
   wrecks to compare. The same code draws the stand-alone atlas page
   (scripts/gallery.js builds build/units.html) and the unit viewer's unit
   list, so it is handed the elements to fill rather than finding them:

     PMCAtlas.mount({
       main,         // where the sheets go
       colours,      // a row for the colour swatches (optional)
       toggles,      // the Show buttons, each with data-t="states|facings|props|wrecks"
       search,       // an input to filter by (optional)
       indexes,      // navs to fill with an index of the units (optional)
       faction,      // () -> 'pmc' | 'rebel' | 'bugs' | 'xeno' to show one army, or null for all
       colour,       // the company colour to start in (default ochre)
       onColour,     // (key) -> a colour was picked
       onPick,       // (key) -> a unit's sheet was clicked
       prefix,       // the id each unit's sheet is given, before its key (default 'u-')
       findMore      // (profile) -> more words a search should match it by (optional)
     })
   returns { render, filter, setColour, scrollTo }. */
(function (root) {
  'use strict';

  function mount(o) {
    var R = root.PMC, I = root.PMCIso;
    var PFX = o.prefix || 'u-';
    var FACES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    // a direction on the screen, turned into a heading on the table
    function faceAngle(i) { var th = i * Math.PI / 4, u = Math.cos(th), v = 2 * Math.sin(th); return Math.atan2(v - u, u + v); }
    var PROPS = R.PROP_ORDER;
    var PROP_NAME = { wheeled: 'Wheeled', tracked: 'Tracked', grav: 'Anti-grav', hover: 'Hover', walker: 'Walker' };
    var byKey = {};
    R.CATALOGUE.forEach(function (p) { byKey[p.key] = p; });

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function kind(p) { return p.cls === 'aircraft' ? 'Aircraft' : p.cls === 'vehicle' ? 'Vehicle' : 'Infantry'; }

    // group the catalogue: faction, then the book's own groups, in book order
    var factions = [['pmc', 'PMC'], ['rebel', 'Rebels'], ['bugs', 'Space Bugs'], ['xeno', 'Xenotripods']];
    var tree = factions.map(function (f) {
      var groups = [], seen = {};
      R.CATALOGUE.filter(function (p) { return (p.faction || 'pmc') === f[0]; }).forEach(function (p) {
        if (!seen[p.group]) { seen[p.group] = { name: p.group, units: [] }; groups.push(seen[p.group]); }
        seen[p.group].units.push(p);
      });
      return { id: f[0], name: f[1], groups: groups };
    });
    function shown() {
      var f = o.faction ? o.faction() : null;
      return f ? tree.filter(function (t) { return t.id === f; }) : tree;
    }

    // ---- index ----
    function indexHtml() {
      return shown().map(function (f) {
        return '<h2>' + f.name + '</h2>' + f.groups.map(function (g) {
          return '<h3>' + esc(g.name) + '</h3><ul>' + g.units.map(function (p) {
            return '<li data-k="' + p.key + '"><a href="#' + PFX + p.key + '"><b>' + esc(p.code) + '</b><span>' + esc(p.name) + '</span></a></li>';
          }).join('') + '</ul>';
        }).join('');
      }).join('');
    }

    // ---- what to show: all off to begin with ----
    var show = { states: false, facings: false, props: false, wrecks: false };
    var colour = o.colour || 'ochre';
    function defaultProp(p) {
      if (p.faction === 'bugs' || p.faction === 'xeno') return null;   // a bug walks on its own legs; a turret stands
      return (R.lookDrive && R.lookDrive(p)) || 'wheeled';
    }
    // what a tile without a running gear is called: a flier, or an Overgrown bug
    function noProp(p) { return p.faction === 'bugs' ? (p.cls === 'aircraft' ? 'Overgrown, flying' : 'Overgrown') : p.faction === 'xeno' ? (p.cls === 'aircraft' ? 'Flight' : 'Turret') : 'Flight'; }

    function tile(p, t, cls) {
      return '<canvas class="tile ' + (cls || '') + '" data-key="' + p.key + '"' +
        (t.prop ? ' data-prop="' + t.prop + '"' : '') + (t.face != null ? ' data-face="' + t.face + '"' : '') +
        (t.status ? ' data-status="' + t.status + '"' : '') + (t.riders ? ' data-riders="1"' : '') +
        (t.mount ? ' data-mount="' + t.mount + '"' : '') +
        ' role="img" aria-label="' + esc(p.name + (t.label ? ' — ' + t.label : '')) + '"></canvas>';
    }
    function machine(p) { return p.cls === 'vehicle' || p.cls === 'aircraft'; }
    function stats(p) {
      return kind(p) + ' · Tier ' + (R.ROMAN ? R.ROMAN[p.tier] : p.tier) + ' · Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · FP ' + (p.fp == null ? '—' : p.fp) +
        ' · Range ' + p.range + '" · Def ' + p.def + (p.str ? ' · Structure ' + p.str : ' · Models ' + p.size);
    }
    // what a search matches: the name, code and key, and whatever else the page adds (the viewer adds the weapons)
    // what a search matches a unit by: its name and code, its group, what it is, every special rule it has, and anything the page adds (its weapon)
    function findKey(p) {
      return esc([p.name, p.code, p.key, p.group || '', p.cls || 'infantry', (p.rules || []).join(' | '),
        o.findMore ? o.findMore(p) : ''].join(' | ').toLowerCase());
    }
    function cell(p, t, cls, cap) {
      return '<figure class="cell">' + tile(p, t, cls) + '<figcaption>' + cap + '</figcaption></figure>';
    }
    function wreckCell(p) {
      return cell(p, { face: 1, status: 'wrecked', prop: p.cls === 'vehicle' ? defaultProp(p) : null, label: 'destroyed, facing SE' }, 'tall', 'Destroyed');
    }

    /* A unit shown as one small card, side by side with the rest of its group:
       infantry ready, a machine on its usual running gear facing SE. */
    function compact(p) {
      var t;
      if (machine(p)) {
        var pr = p.cls === 'vehicle' ? defaultProp(p) : null;
        t = cell(p, { face: 1, prop: pr, label: (pr ? PROP_NAME[pr] + ', ' : '') + 'facing SE' }, p.cls === 'aircraft' || pr === 'walker' || p.faction === 'bugs' || p.faction === 'xeno' ? 'tall' : '',
          pr ? PROP_NAME[pr] : noProp(p));
        if (show.wrecks) t += wreckCell(p);
      } else {
        if (p.group === 'Mounted Warriors') {
          // bikes, grav bikes and horses: the same riders on each (p. 93)
          t = R.MOUNT_ORDER.map(function (m) { return cell(p, { status: 'ready', mount: m, label: R.MOUNTS[m].name }, 'inf', R.MOUNTS[m].name); }).join('');
        } else {
          t = cell(p, { status: 'ready', label: 'Ready' }, 'inf', 'Ready');
          if (p.ridersUpgrade && show.states) t += R.MOUNT_ORDER.map(function (m) { return cell(p, { status: 'ready', riders: true, mount: m, label: 'Riders, ' + R.MOUNTS[m].name }, 'inf', R.MOUNTS[m].name); }).join('');
        }
      }
      return '<div class="card unit" id="' + PFX + p.key + '" data-k="' + p.key + '" data-find="' + findKey(p) + '" title="' + esc(stats(p)) + '">' +
        '<h4><span class="code">' + esc(p.code) + '</span><span class="tier">Tier ' + R.ROMAN[p.tier] + '</span></h4>' +
        '<div class="nm">' + esc(p.name) + '</div>' +
        '<div class="tiles">' + t + '</div></div>';
    }

    // the full sheet for one unit, as wide as the toggles ask for
    function sheet(p) {
      if (!machine(p)) {
        var cells = [['ready', 'Ready'], ['suppressed', 'Suppressed'], ['broken', 'Broken']].map(function (st) {
          return cell(p, { status: st[0], label: st[1] }, 'inf', st[1]);
        });
        if (p.group === 'Mounted Warriors') R.MOUNT_ORDER.slice(1).forEach(function (m) { cells.push(cell(p, { status: 'ready', mount: m, label: R.MOUNTS[m].name }, 'inf', R.MOUNTS[m].name)); });
        if (p.ridersUpgrade) R.MOUNT_ORDER.forEach(function (m) { cells.push(cell(p, { status: 'ready', riders: true, mount: m, label: 'Riders, ' + R.MOUNTS[m].name }, 'inf', 'Riders · ' + R.MOUNTS[m].name)); });
        return '<div class="strip">' + cells.join('') + '</div>';
      }
      var props = p.cls === 'vehicle' && p.key !== 'insertplat' && p.faction !== 'bugs' && p.faction !== 'xeno' ? (show.props ? PROPS : [defaultProp(p)]) : [null];
      if (!show.facings) {
        // one SE tile per movement type, side by side
        var strip = props.map(function (pr) {
          return cell(p, { face: 1, prop: pr, label: (pr ? PROP_NAME[pr] + ', ' : '') + 'facing SE' }, pr === 'walker' || !pr ? 'tall' : '', pr ? PROP_NAME[pr] : noProp(p));
        });
        if (show.wrecks) strip.push(wreckCell(p));
        return '<div class="strip">' + strip.join('') + '</div>';
      }
      var head = '<div class="row head"><div></div>' + FACES.map(function (f) { return '<div>' + f + '</div>'; }).join('') + '</div>';
      var rows = props.map(function (pr) {
        return '<div class="row"><div class="lab">' + (pr ? PROP_NAME[pr] : p.key === 'insertplat' ? 'Landed' : noProp(p)) + '</div>' + FACES.map(function (f, i) {
          return tile(p, { prop: pr, face: i, label: (pr ? PROP_NAME[pr] + ', ' : '') + 'facing ' + f }, pr === 'walker' || (!pr && p.cls === 'aircraft') ? 'tall' : '');
        }).join('') + '</div>';
      });
      if (show.wrecks) {
        rows.push('<div class="row"><div class="lab">Destroyed</div>' + FACES.map(function (f, i) {
          return i === 1 ? tile(p, { face: i, status: 'wrecked', prop: p.cls === 'vehicle' ? defaultProp(p) : null, label: 'destroyed, facing SE' }, 'tall') : '<div></div>';
        }).join('') + '</div>');
      }
      return '<div class="sheet"><div class="grid">' + head + rows.join('') + '</div></div>';
    }
    function article(p) {
      return '<article class="unit" id="' + PFX + p.key + '" data-k="' + p.key + '" data-find="' + findKey(p) + '">' +
        '<header><span class="code">' + esc(p.code) + '</span><span class="uname">' + esc(p.name) + '</span>' +
        '<span class="meta">' + stats(p) + ' · model <code>' + esc(p.art) + '</code> · key <code>' + esc(p.key) + '</code></span></header>' +
        sheet(p) + '</article>';
    }
    /* Infantry without its states, and machines with neither facings nor
       movement types, collapse to cards laid side by side through the group,
       lowest Tier first. */
    function isCompact(p) { return machine(p) ? (!show.facings && !show.props) : !show.states; }

    var main = o.main;
    var io = null;
    function render() {
      var many = shown().length > 1;
      main.innerHTML = shown().map(function (f) {
        return (many ? '<h2 class="faction" id="f-' + f.id + '">' + f.name + '</h2>' : '') + f.groups.map(function (g) {
          var cards = g.units.filter(isCompact).slice().sort(function (a, b) { return a.tier - b.tier; });
          var full = g.units.filter(function (p) { return !isCompact(p); });
          return '<section data-group><h3 class="group">' + esc(g.name) + '</h3>' +
            (cards.length ? '<div class="cards">' + cards.map(compact).join('') + '</div>' : '') +
            full.map(article).join('') + '</section>';
        }).join('');
      }).join('') + '<p class="empty" data-none hidden>No unit matches that search.</p>';
      (o.indexes || []).forEach(function (n) { n.innerHTML = indexHtml(); });
      if (io) io.disconnect();
      var tiles = Array.prototype.slice.call(main.querySelectorAll('canvas.tile'));
      io = 'IntersectionObserver' in root ? new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && e.target.dataset.drawn !== colour) draw(e.target); });
      }, { root: o.scroller || null, rootMargin: '400px 0px' }) : null;
      if (io) tiles.forEach(function (c) { io.observe(c); }); else tiles.forEach(draw);
      filter();
    }

    // ---- drawing, only as tiles come into view ----
    function draw(cv) {
      var p = byKey[cv.dataset.key];
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      var W = cv.clientWidth || 132, H = cv.clientHeight || 112;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      var face = cv.dataset.face != null ? faceAngle(+cv.dataset.face) : faceAngle(1);
      var u = Object.assign({}, p, {
        id: 'G' + p.key, side: 'A', facing: face, alive: true, damage: 0, sp: 0, cargo: [],
        rules: (p.rules || []).slice(), models: p.size, x: 10, y: 10
      });
      if (p.cls === 'vehicle' && p.faction !== 'bugs' && p.faction !== 'xeno') R.applyPropulsion(u, cv.dataset.prop || defaultProp(p));
      if (cv.dataset.riders) R.applyRiders(u, true);
      if (cv.dataset.mount) u.mount = cv.dataset.mount;
      var mach = machine(p);
      var walker = cv.dataset.prop === 'walker';
      // a tile drawn narrower than the width it was framed for (o.fit) shrinks its figure to match, rather than cropping it
      var ref = o.fit && (cv.classList.contains('inf') ? o.fit.inf : o.fit.other), k = ref ? Math.min(1, W / ref) : 1;
      var mag = k * (mach ? (p.faction === 'bugs' ? 0.72 : p.faction === 'xeno' && p.cls === 'vehicle' ? 1.3 : p.cls === 'aircraft' ? 1.0 : walker ? 1.05 : 1.15) : 1.55);
      var ground = H - k * (mach ? (p.faction === 'bugs' ? 18 : walker || p.cls === 'aircraft' ? 14 : 26) : 16);
      var s0 = I.toScreen(10, 10);
      // the atlas draws as the first side, in its colour (repainting a side throws its baked figures away, so only on a change)
      if (I.PALETTE.A !== I.COLOURS[colour]) I.setSideColour('A', colour);
      try {
        if (cv.dataset.status === 'wrecked') {
          // a wreck sits on the ground, so it is framed like a ground vehicle and has headroom for its smoke
          u.alive = false;
          var gw = H - 30 * k;
          g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (gw - s0.y * mag) * dpr);
          I.drawWreck(g, u, { x: 10, y: 10 }, 0, 1700);
        } else {
          g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (ground - s0.y * mag) * dpr);
          I.drawUnit(g, u, { at: { x: 10, y: 10 }, lift: 0, status: cv.dataset.status || 'ready', morale: 0 });
        }
      } catch (e) { if (root.console) console.error(p.key, e); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      cv.dataset.drawn = colour;
    }

    // ---- colours: every company colour the game offers ----
    var sw = o.colours;
    function drawSwatches() {
      if (!sw) return;
      sw.innerHTML = I.COLOUR_KEYS.map(function (k) {
        var c = I.COLOURS[k];
        return '<button type="button" data-c="' + k + '" title="' + esc(c.name) + '" aria-pressed="' + (k === colour) + '"><i style="background:' + c.mid + '"></i>' + esc(c.name) + '</button>';
      }).join('');
    }
    function setColour(k) {
      if (!I.COLOURS[k]) return;
      colour = k;
      drawSwatches();
      Array.prototype.forEach.call(main.querySelectorAll('canvas.tile'), function (c) {
        var r = c.getBoundingClientRect();
        if (r.bottom > -400 && r.top < innerHeight + 400) draw(c); else c.dataset.drawn = '';
      });
    }
    if (sw) {
      drawSwatches();
      sw.addEventListener('click', function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        setColour(b.dataset.c);
        if (o.onColour) o.onColour(colour);
      });
    }

    // ---- the toggles ----
    if (o.toggles) {
      o.toggles.addEventListener('click', function (e) {
        var b = e.target.closest('[data-t]'); if (!b) return;
        var k = b.dataset.t;
        show[k] = !show[k];
        b.setAttribute('aria-pressed', String(show[k]));
        render();
      });
    }

    // ---- a unit's sheet, clicked ----
    if (o.onPick) {
      main.addEventListener('click', function (e) {
        var u = e.target.closest('.unit[data-k]');
        if (u) o.onPick(u.dataset.k);
      });
    }

    // ---- search ----
    function filter() {
      var q = o.search ? o.search.value.trim().toLowerCase() : '', any = false;
      /* The words as a phrase first ("machine gun"); failing that, a unit has
         to answer to every one of them on its own ("sappers insertion"). */
      var cards = main.querySelectorAll('.unit[data-find]');
      var terms = q ? q.split(/[\s,]+/).filter(Boolean) : [];
      var phrase = terms.length > 1 && Array.prototype.some.call(cards, function (a) { return a.dataset.find.indexOf(q) >= 0; });
      Array.prototype.forEach.call(cards, function (a) {
        var f = a.dataset.find;
        var hit = !terms.length || (phrase ? f.indexOf(q) >= 0 : terms.every(function (t) { return f.indexOf(t) >= 0; }));
        a.hidden = !hit; if (hit) any = true;
      });
      Array.prototype.forEach.call(main.querySelectorAll('section[data-group]'), function (s) {
        s.hidden = !s.querySelector('.unit:not([hidden])');
      });
      (o.indexes || []).forEach(function (n) {
        Array.prototype.forEach.call(n.querySelectorAll('li'), function (li) {
          var a = main.querySelector('#' + PFX + li.dataset.k);
          li.hidden = a ? a.hidden : false;
        });
      });
      var none = main.querySelector('[data-none]');
      if (none) none.hidden = any;
    }
    if (o.search) o.search.addEventListener('input', filter);

    function scrollTo(key) {
      var a = main.querySelector('#' + PFX + key);
      if (a) a.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    render();
    return { render: render, filter: filter, setColour: setColour, scrollTo: scrollTo };
  }

  root.PMCAtlas = { mount: mount };
})(typeof window !== 'undefined' ? window : this);
