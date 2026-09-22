/* Builds build/units.html: every unit in both army lists, drawn by the game's
   own renderer — squads in each state, machines at every facing on every
   propulsion — with an index down the side. Run: node gallery.js */
const fs = require('fs');
const path = require('path');
// the tool lives in scripts/; everything it reads and writes is a level up
const ROOT = path.join(__dirname, '..');
const rules = fs.readFileSync(path.join(ROOT, 'src/rules/rules.js'), 'utf8');
const iso = fs.readFileSync(path.join(ROOT, 'src/view/iso.js'), 'utf8');

const page = `<title>PMC 2670 Unit Atlas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --bg: #eef0ec; --panel: #fbfcfa; --ink: #1c211d; --muted: #5a645c; --line: #d3d9d1;
  --accent: #946618; --accent-ink: #ffffff; --chip: #e2e6df; --field: #5e5039; --field-edge: #4a3f2d;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  --body: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121614; --panel: #181d1a; --ink: #e3e8e2; --muted: #95a198; --line: #2b332e;
    --accent: #d8a13a; --accent-ink: #1a1408; --chip: #232a26; --field: #5e5039; --field-edge: #2e271c;
  }
}
:root[data-theme="dark"] {
  --bg: #121614; --panel: #181d1a; --ink: #e3e8e2; --muted: #95a198; --line: #2b332e;
  --accent: #d8a13a; --accent-ink: #1a1408; --chip: #232a26; --field: #5e5039; --field-edge: #2e271c;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 14px/1.5 var(--body); margin: 0; }
a { color: inherit; }
.wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 28px; padding-inline: 20px; padding-block: 0 48px; max-width: 1500px; margin: 0 auto; }
header.top { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: end; gap: 12px 28px; padding-block: 22px 14px; border-bottom: 1px solid var(--line); }
header.top h1 { font: 700 34px/1 var(--display); letter-spacing: .02em; margin: 0; text-transform: uppercase; }
header.top h1 span { color: var(--accent); }
header.top p { margin: 0; color: var(--muted); max-width: 60ch; }
.controls { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin-left: auto; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.seg button { font: 600 13px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; padding: 8px 12px; border: 0; background: var(--panel); color: var(--muted); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }
.seg button:focus-visible, input:focus-visible, nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input#q { font: 14px var(--body); padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); width: 220px; max-width: 100%; }
label.ctl { font: 600 12px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); display: inline-flex; gap: 8px; align-items: center; }

nav.index { position: sticky; top: env(safe-area-inset-top, 0px); align-self: start; max-height: 100vh; overflow-y: auto; padding-block: 18px; font-size: 13px; }
nav.index h2 { font: 700 18px var(--display); text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 4px; }
nav.index h3 { font: 600 12px var(--display); text-transform: uppercase; letter-spacing: .09em; color: var(--muted); margin: 12px 0 2px; }
nav.index ul { list-style: none; margin: 0; padding: 0; }
nav.index a { display: grid; grid-template-columns: 38px 1fr; gap: 6px; text-decoration: none; padding: 2px 4px; border-radius: 4px; }
nav.index a:hover { background: var(--chip); }
nav.index a b { font: 500 11px/1.9 var(--mono); color: var(--accent); }
details.mobile-index { display: none; }

main h2.faction { font: 700 28px var(--display); text-transform: uppercase; letter-spacing: .04em; margin: 30px 0 4px; }
main h3.group { font: 600 15px var(--display); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
article.unit { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px 16px; margin-bottom: 14px; scroll-margin-top: 12px; }
article.unit header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-bottom: 10px; }
.code { font: 600 13px var(--mono); background: var(--accent); color: var(--accent-ink); padding: 2px 7px; border-radius: 4px; }
.uname { font: 600 21px/1.1 var(--display); letter-spacing: .02em; text-wrap: balance; }
.meta { color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.meta code { font: 12px var(--mono); }
.sheet { overflow-x: auto; }
.grid { display: grid; gap: 6px; }
.row { display: grid; grid-template-columns: 74px repeat(8, 132px); gap: 6px; align-items: center; min-width: max-content; }
.row.head div { font: 600 12px var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); text-align: center; }
.row .lab { font: 600 12px var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.strip { display: flex; flex-wrap: wrap; gap: 6px; }
figure.cell { margin: 0; }
figure.cell figcaption { font: 600 11.5px var(--display); letter-spacing: .09em; text-transform: uppercase; color: var(--muted); text-align: center; padding-top: 3px; }
canvas.tile { display: block; width: 132px; height: 112px; background: radial-gradient(ellipse at 50% 60%, #6b5c43 0%, var(--field) 55%, var(--field-edge) 100%); border-radius: 5px; }
canvas.tile.tall { height: 150px; }
canvas.tile.inf { width: 150px; height: 118px; }
.bar2 { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.swatches button { display: inline-flex; align-items: center; gap: 6px; font: 600 12px/1 var(--display); letter-spacing: .05em; text-transform: uppercase; padding: 6px 10px 6px 7px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--muted); cursor: pointer; }
.swatches button i { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.25); }
.swatches button[aria-pressed="true"] { border-color: var(--accent); color: var(--ink); box-shadow: 0 0 0 1px var(--accent); }
.toggles { display: flex; flex-wrap: wrap; gap: 6px; }
.toggles button { font: 600 12.5px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--muted); cursor: pointer; }
.toggles button::before { content: ''; display: inline-block; width: 9px; height: 9px; margin-right: 7px; border: 1.5px solid currentColor; border-radius: 2px; vertical-align: -1px; }
.toggles button[aria-pressed="true"] { color: var(--ink); border-color: var(--accent); }
.toggles button[aria-pressed="true"]::before { background: var(--accent); border-color: var(--accent); }
.swatches button:focus-visible, .toggles button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cards { display: flex; flex-wrap: wrap; gap: 10px; }
.card.unit { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 8px 10px; width: min-content; scroll-margin-top: 12px; display: flex; flex-direction: column; }
/* names wrap to different heights: the pictures sit on the card's floor, so every picture in a row lines up */
.card.unit .tiles { margin-top: auto; align-items: flex-end; }
.card.unit h4 { contain: inline-size; }
.card.unit h4 { margin: 0 0 4px; display: flex; gap: 6px; align-items: baseline; }
.card.unit h4 .tier { font: 500 11px var(--mono); color: var(--muted); margin-left: auto; }
.card.unit .nm { font: 600 15px/1.15 var(--display); letter-spacing: .02em; min-height: 2.35em; margin-bottom: 6px; contain: inline-size; text-wrap: balance; }
.card.unit h4 .tier, .card.unit h4 .code { flex-shrink: 0; }
.card .tiles { display: flex; gap: 6px; }
.card .cap { font: 600 11px var(--display); letter-spacing: .09em; text-transform: uppercase; color: var(--muted); text-align: center; padding-top: 3px; }
.strip .cell canvas.tile.tall { height: 150px; }
.empty { color: var(--muted); padding: 30px 0; }
@media (max-width: 860px) {
  .wrap { grid-template-columns: minmax(0, 1fr); padding-inline: 16px; }
  nav.index { display: none; }
  details.mobile-index { display: block; margin-top: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 8px 12px; }
  details.mobile-index summary { font: 600 14px var(--display); letter-spacing: .08em; text-transform: uppercase; cursor: pointer; }
  details.mobile-index nav.index { display: block; position: static; max-height: 60vh; }
  .controls { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
html { scroll-behavior: smooth; }
</style>

<div class="wrap">
  <header class="top">
    <h1>PMC 2670 <span>Unit Atlas</span></h1>
    <p>Every profile in both army lists, drawn by the game’s own renderer. Pick a company colour; turn on the states, facings, movement types and wrecks you want to compare.</p>
    <div class="controls">
      <input id="q" type="search" placeholder="Find a unit — name or code" aria-label="Find a unit">
    </div>
    <div class="bar2">
      <label class="ctl">Colours</label>
      <div class="swatches" id="colours" role="group" aria-label="Company colours"></div>
    </div>
    <div class="bar2">
      <label class="ctl">Show</label>
      <div class="toggles" id="toggles" role="group" aria-label="What to show">
        <button type="button" data-t="states" aria-pressed="false">Suppressed &amp; broken</button>
        <button type="button" data-t="facings" aria-pressed="false">All facings</button>
        <button type="button" data-t="props" aria-pressed="false">Movement types</button>
        <button type="button" data-t="wrecks" aria-pressed="false">Destroyed</button>
      </div>
    </div>
    <details class="mobile-index"><summary>Index</summary><nav class="index" id="index-m"></nav></details>
  </header>
  <nav class="index" id="index" aria-label="Unit index"></nav>
  <main id="main"></main>
</div>

<script>${rules}</script>
<script>${iso}</script>
<script>
(function () {
  var R = window.PMC, I = window.PMCIso;
  var FACES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  // a direction on the screen, turned into a heading on the table
  function faceAngle(i) { var th = i * Math.PI / 4, u = Math.cos(th), v = 2 * Math.sin(th); return Math.atan2(v - u, u + v); }
  var PROPS = R.PROP_ORDER;
  var PROP_NAME = { wheeled: 'Wheeled', tracked: 'Tracked', grav: 'Anti-grav', hover: 'Hover', walker: 'Walker' };
  var side = 'A';
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

  // ---- index ----
  function indexHtml() {
    return tree.map(function (f) {
      return '<h2>' + f.name + '</h2>' + f.groups.map(function (g) {
        return '<h3>' + esc(g.name) + '</h3><ul>' + g.units.map(function (p) {
          return '<li data-k="' + p.key + '"><a href="#u-' + p.key + '"><b>' + esc(p.code) + '</b><span>' + esc(p.name) + '</span></a></li>';
        }).join('') + '</ul>';
      }).join('');
    }).join('');
  }
  document.getElementById('index').innerHTML = indexHtml();
  document.getElementById('index-m').innerHTML = indexHtml();

  // ---- what to show: all off to begin with ----
  var show = { states: false, facings: false, props: false, wrecks: false };
  var colour = 'ochre';
  function defaultProp(p) {
    if (p.faction === 'bugs' || p.faction === 'xeno') return null;   // a bug walks on its own legs; a turret stands
    return (R.defaultDrive && R.defaultDrive(p)) || 'wheeled';
  }
  // what a tile without a running gear is called: a flier, or an Overgrown bug
  function noProp(p) { return p.faction === 'bugs' ? (p.cls === 'aircraft' ? 'Overgrown, flying' : 'Overgrown') : p.faction === 'xeno' ? (p.cls === 'aircraft' ? 'Flight' : 'Turret') : 'Flight'; }

  function tile(p, o, cls) {
    return '<canvas class="tile ' + (cls || '') + '" data-key="' + p.key + '"' +
      (o.prop ? ' data-prop="' + o.prop + '"' : '') + (o.face != null ? ' data-face="' + o.face + '"' : '') +
      (o.status ? ' data-status="' + o.status + '"' : '') + (o.riders ? ' data-riders="1"' : '') +
      (o.mount ? ' data-mount="' + o.mount + '"' : '') +
      ' role="img" aria-label="' + esc(p.name + (o.label ? ' — ' + o.label : '')) + '"></canvas>';
  }
  function machine(p) { return p.cls === 'vehicle' || p.cls === 'aircraft'; }
  function stats(p) {
    return kind(p) + ' · Tier ' + (R.ROMAN ? R.ROMAN[p.tier] : p.tier) + ' · Move ' + p.move + '" · FP ' + (p.fp == null ? '—' : p.fp) +
      ' · Range ' + p.range + '" · Def ' + p.def + (p.str ? ' · Structure ' + p.str : ' · Models ' + p.size);
  }
  function findKey(p) { return esc((p.name + ' ' + p.code + ' ' + p.key).toLowerCase()); }
  function cell(p, o, cls, cap) {
    return '<figure class="cell">' + tile(p, o, cls) + '<figcaption>' + cap + '</figcaption></figure>';
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
    return '<div class="card unit" id="u-' + p.key + '" data-k="' + p.key + '" data-find="' + findKey(p) + '" title="' + esc(stats(p)) + '">' +
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
    return '<article class="unit" id="u-' + p.key + '" data-k="' + p.key + '" data-find="' + findKey(p) + '">' +
      '<header><span class="code">' + esc(p.code) + '</span><span class="uname">' + esc(p.name) + '</span>' +
      '<span class="meta">' + stats(p) + ' · model <code>' + esc(p.art) + '</code> · key <code>' + esc(p.key) + '</code></span></header>' +
      sheet(p) + '</article>';
  }
  /* Infantry without its states, and machines with neither facings nor
     movement types, collapse to cards laid side by side through the group,
     lowest Tier first. */
  function isCompact(p) { return machine(p) ? (!show.facings && !show.props) : !show.states; }

  var main = document.getElementById('main');
  var io = null;
  function renderMain() {
    main.innerHTML = tree.map(function (f) {
      return '<h2 class="faction" id="f-' + f.id + '">' + f.name + '</h2>' + f.groups.map(function (g) {
        var cards = g.units.filter(isCompact).slice().sort(function (a, b) { return a.tier - b.tier; });
        var full = g.units.filter(function (p) { return !isCompact(p); });
        return '<section data-group><h3 class="group">' + esc(g.name) + '</h3>' +
          (cards.length ? '<div class="cards">' + cards.map(compact).join('') + '</div>' : '') +
          full.map(article).join('') + '</section>';
      }).join('');
    }).join('') + '<p class="empty" id="none" hidden>No unit matches that search.</p>';
    if (io) io.disconnect();
    var tiles = Array.prototype.slice.call(document.querySelectorAll('canvas.tile'));
    io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && e.target.dataset.drawn !== colour) draw(e.target); });
    }, { rootMargin: '400px 0px' }) : null;
    if (io) tiles.forEach(function (c) { io.observe(c); }); else tiles.forEach(draw);
    filter();
  }

  // ---- drawing, only as tiles come into view ----
  function draw(cv) {
    var p = byKey[cv.dataset.key];
    var dpr = Math.min(2, window.devicePixelRatio || 1);
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
    var mag = mach ? (p.faction === 'bugs' ? 0.72 : p.faction === 'xeno' && p.cls === 'vehicle' ? 1.3 : p.cls === 'aircraft' ? 1.0 : walker ? 1.05 : 1.15) : 1.55;
    var ground = mach ? H - (p.faction === 'bugs' ? 18 : walker || p.cls === 'aircraft' ? 14 : 26) : H - 16;
    var s0 = I.toScreen(10, 10);
    if (cv.dataset.status === 'wrecked') {
      // a wreck sits on the ground, so it is framed like a ground vehicle and has headroom for its smoke
      u.alive = false;
      var gw = H - 30;
      g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (gw - s0.y * mag) * dpr);
      try { I.drawWreck(g, u, { x: 10, y: 10 }, 0, 1700); } catch (e) { console.error(p.key, e); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      cv.dataset.drawn = colour;
      return;
    }
    g.setTransform(mag * dpr, 0, 0, mag * dpr, (W / 2 - s0.x * mag) * dpr, (ground - s0.y * mag) * dpr);
    try {
      I.drawUnit(g, u, { at: { x: 10, y: 10 }, lift: 0, status: cv.dataset.status || 'ready', morale: 0 });
    } catch (e) { console.error(p.key, e); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    cv.dataset.drawn = colour;
  }

  // ---- colours: every company colour the game offers ----
  var sw = document.getElementById('colours');
  sw.innerHTML = I.COLOUR_KEYS.map(function (k) {
    var c = I.COLOURS[k];
    return '<button type="button" data-c="' + k + '" aria-pressed="' + (k === colour) + '"><i style="background:' + c.mid + '"></i>' + esc(c.name) + '</button>';
  }).join('');
  sw.addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    colour = b.dataset.c;
    I.setSideColour('A', colour);
    Array.prototype.forEach.call(sw.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    Array.prototype.forEach.call(document.querySelectorAll('canvas.tile'), function (c) {
      var r = c.getBoundingClientRect();
      if (r.bottom > -400 && r.top < innerHeight + 400) draw(c); else c.dataset.drawn = '';
    });
  });
  I.setSideColour('A', colour);

  // ---- the toggles ----
  document.getElementById('toggles').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b) return;
    var k = b.dataset.t;
    show[k] = !show[k];
    b.setAttribute('aria-pressed', String(show[k]));
    renderMain();
  });

  // ---- search ----
  function filter() {
    var q = document.getElementById('q').value.trim().toLowerCase(), any = false;
    Array.prototype.forEach.call(document.querySelectorAll('.unit[data-find]'), function (a) {
      var hit = !q || a.dataset.find.indexOf(q) >= 0;
      a.hidden = !hit; if (hit) any = true;
    });
    Array.prototype.forEach.call(document.querySelectorAll('section[data-group]'), function (s) {
      s.hidden = !s.querySelector('.unit:not([hidden])');
    });
    Array.prototype.forEach.call(document.querySelectorAll('nav.index li'), function (li) {
      var a = document.getElementById('u-' + li.dataset.k);
      li.hidden = a ? a.hidden : false;
    });
    var none = document.getElementById('none');
    if (none) none.hidden = any;
  }
  document.getElementById('q').addEventListener('input', filter);
  renderMain();
})();
</script>
`;
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'units.html'), page);
console.log('build/units.html', (page.length / 1024).toFixed(0) + ' KB');
