/* Builds build/units.html: every unit in both army lists, drawn by the game's
   own renderer — squads in each state, machines at every facing on every
   propulsion — with an index down the side. Run: node gallery.js */
const fs = require('fs');
const path = require('path');
// the tool lives in scripts/; everything it reads and writes is a level up
const ROOT = path.join(__dirname, '..');
const rules = fs.readFileSync(path.join(ROOT, 'src/rules/rules.js'), 'utf8');
/* The renderer is iso.js and the parts it installs (iso-*.js), loaded before
   it: all of them, in the order the game's own page loads them. */
const iso = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/src\/view\/iso[\w-]*\.js/g) || ['src/view/iso.js'])
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
// the atlas itself, shared with the unit viewer's Atlas mode
const atlas = fs.readFileSync(path.join(ROOT, 'src/view/atlas.js'), 'utf8');

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
<script>${atlas}</script>
<script>
PMCAtlas.mount({
  main: document.getElementById('main'),
  colours: document.getElementById('colours'),
  toggles: document.getElementById('toggles'),
  search: document.getElementById('q'),
  indexes: [document.getElementById('index'), document.getElementById('index-m')]
});
</script>
`;
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'units.html'), page);
console.log('build/units.html', (page.length / 1024).toFixed(0) + ' KB');
