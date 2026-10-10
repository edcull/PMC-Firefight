// The all-faction report (run by report.js).
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { C } = require(path.join(__dirname, '../../server/rules.js'));
const OUT = process.env.OUT, DIR = process.env.DIR;
const runs = fs.readdirSync(DIR).filter((f) => /^run\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(DIR + '/' + f)));
const FACS = ['pmc', 'rebel', 'bugs', 'xeno'], FN = { pmc: 'PMC', rebel: 'Rebels', bugs: 'Bugs', xeno: 'Xenotripods' };
const FAC = {}, NAME = {};
FACS.forEach((f) => C.archetypesFor(f).forEach((a) => { FAC[a.id] = f; NAME[a.id] = a.name; }));
const IDS = runs[0].end.map((e) => e.arch);
const SCEN = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const SN = { meeting: 'Meeting', secure: 'Secure', find: 'Find & retrieve', invasion: 'Invasion', demolish: 'Demolition', takeover: 'Takeover' };
const GREEN = '#2f9e5b', RED = '#d0473a', INK = '#1d1d1b', DIM = '#6b6b66', EMPTY = '#f1f1ee';
const p = (x) => Math.round(100 * x) + '%';
const L = runs.flatMap((r) => r.log);
const sides = [];
L.forEach((b) => ['A', 'B'].forEach((sd) => {
  const me = b[sd], foe = b[sd === 'A' ? 'B' : 'A'];
  sides.push({ me, foe, fm: FAC[me], ff: FAC[foe], cross: FAC[me] !== FAC[foe], scen: b.scenario,
    role: b.atk ? (b.atk === me ? 'attacker' : 'defender') : null, res: b.winner == null ? 'd' : b.winner === me ? 'w' : 'l',
    loss: sd === 'A' ? b.lossA : b.lossB, dealt: sd === 'A' ? b.lossB : b.lossA, tier: b.tier });
}));
function tally(rows) {
  const t = { n: rows.length, w: 0, d: 0, l: 0, loss: 0, dealt: 0, hi: 0 };
  rows.forEach((r) => { t[r.res]++; t.loss += r.loss; t.dealt += r.dealt; if (r.loss >= 0.4) t.hi++; });
  t.win = t.n ? t.w / t.n : 0; t.avgLoss = t.n ? t.loss / t.n : 0; t.avgDealt = t.n ? t.dealt / t.n : 0; t.hiRate = t.n ? t.hi / t.n : 0; return t;
}
const S = (f) => tally(sides.filter(f));
function cell(t, min, cls) {
  if (!t || t.n < (min || 15)) return `<td class="na${cls ? ' ' + cls : ''}">${t && t.n ? 'n' + t.n : ''}</td>`;
  const d = t.win - 0.5, a = Math.min(0.75, Math.abs(d) * 2.2), col = d >= 0 ? GREEN : RED;
  return `<td${cls ? ` class="${cls}"` : ''} style="background:${col}${Math.round(a * 255).toString(16).padStart(2, '0')}"><b>${p(t.win)}</b><small>${p(t.avgLoss)} lost · n${t.n}</small></td>`;
}
const ends = {}; IDS.forEach((id) => { ends[id] = runs.map((r) => r.end.find((e) => e.arch === id)); });
const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
const turns = runs[0].turns, marks = [4, 8, 12, 16, 20, 24].filter((t) => t <= turns);
const tierAt = (id, t) => { const i = IDS.indexOf(id); return avg(runs, (r) => r.tiers[t - 1][i]); };
const all = S(() => true);
const crossWin = (id) => S((r) => r.me === id && r.cross);
const ranked = IDS.slice().sort((a, b) => crossWin(b).win - crossWin(a).win);
const facRow = (f) => `<tr class="fh"><td class="rn" colspan="99">${FN[f]}</td></tr>`;


// the run before (PREV: its directory), win rates against the other factions then and now
let changeSec = '';
if (process.env.PREV) {
  const pr = fs.readdirSync(process.env.PREV).filter((f) => /^run\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(process.env.PREV + '/' + f)));
  const ps2 = []; pr.flatMap((r) => r.log).forEach((b) => ['A', 'B'].forEach((sd) => { const me = b[sd], foe = b[sd === 'A' ? 'B' : 'A'];
    ps2.push({ me, fm: FAC[me], cross: FAC[me] !== FAC[foe], scen: b.scenario, res: b.winner == null ? 'd' : b.winner === me ? 'w' : 'l', loss: sd === 'A' ? b.lossA : b.lossB }); }));
  const P = (f) => tally(ps2.filter(f));
  const dv = (a, b) => { const x = Math.round(100 * (a - b)); return `<span style="color:${Math.abs(x) < 4 ? DIM : x > 0 ? GREEN : RED}">${x > 0 ? '+' : ''}${x}</span>`; };
  const row = (name, a, b) => `<tr><td class="rn">${name}</td><td>${p(a.win)}</td><td>${p(b.win)}</td><td>${dv(a.win, b.win)}</td><td>${p(a.avgLoss)}</td><td>${p(b.avgLoss)}</td></tr>`;
  const head = '<tr><th class="rn"></th><th>Now</th><th>Before</th><th>Change</th><th>Own loss now</th><th>Before</th></tr>';
  changeSec = `<h2>What changed since the last run</h2><p>${process.env.PREV_NOTE || ''} The run before: ${pr.length} campaigns. Win rates against the other factions; a few points either way is noise for a personality (about ±4), less for a faction.</p>
  <div class="sec"><div class="ct">Factions</div><table class="num">${head}${FACS.map((f) => row('<b>' + FN[f] + '</b>', S((r) => r.fm === f && r.cross), P((r) => r.fm === f && r.cross))).join('')}</table></div>
  <div class="sec"><div class="ct">Factions in the ground-taking scenarios (Secure, Find)</div><table class="num">${head}${FACS.map((f) => row('<b>' + FN[f] + '</b>', S((r) => r.fm === f && r.cross && (r.scen === 'secure' || r.scen === 'find')), P((r) => r.fm === f && r.cross && (r.scen === 'secure' || r.scen === 'find')))).join('')}</table></div>
  <div class="sec"><div class="ct">Personalities</div><table class="num">${head}${FACS.map((f) => facRow(f) + IDS.filter((id) => FAC[id] === f).map((id) => row(NAME[id], S((r) => r.me === id && r.cross), P((r) => r.me === id && r.cross))).join('')).join('')}</table></div>`;
}

// faction against faction
let fvf = `<div class="sec"><div class="ct">Faction against faction: the row's win rate against the column</div><table class="g"><tr><th></th>${FACS.map((f) => `<th>vs ${FN[f]}</th>`).join('')}<th class="tot">vs other factions</th></tr>`;
FACS.forEach((a) => { fvf += `<tr><td class="rn"><b>${FN[a]}</b></td>${FACS.map((b) => a === b ? cell(S((r) => r.fm === a && r.ff === b)).replace(/<b>[^<]*<\/b>/, '<b>—</b>') : cell(S((r) => r.fm === a && r.ff === b))).join('')}${cell(S((r) => r.fm === a && r.cross), 15, 'tot')}</tr>`; });
fvf += `</table><div class="cap">The diagonal (a faction against itself) is always 50%, shown for its losses.</div></div>`;

// the 24, each against each faction
let pvf = `<div class="sec"><div class="ct">Each personality against each faction</div><table class="g"><tr><th></th>${FACS.map((f) => `<th>vs ${FN[f]}</th>`).join('')}<th class="tot">vs other factions</th><th>vs all</th></tr>`;
FACS.forEach((f) => { pvf += facRow(f); IDS.filter((id) => FAC[id] === f).forEach((id) => {
  pvf += `<tr><td class="rn">${NAME[id]}</td>${FACS.map((g) => cell(S((r) => r.me === id && r.ff === g))).join('')}${cell(crossWin(id), 15, 'tot')}${cell(S((r) => r.me === id))}</tr>`; }); });
pvf += `</table><div class="cap">Each cell: win rate, average own loss, battles. Against its own faction a personality meets only the other five.</div></div>`;

// overview
const ov = `<table class="num"><tr><th class="rn">#</th><th class="rn">Personality</th><th class="rn">Faction</th><th>Battles</th><th>Won vs other factions</th><th>Won overall</th><th>Avg own loss</th><th>Loss inflicted</th><th>High-loss</th><th>Tier at end</th><th>T3 PL2 by end</th><th>Roster</th><th>Hulls</th></tr>
${ranked.map((id, i) => { const t = S((r) => r.me === id), c = crossWin(id), e = ends[id], col = c.win >= 0.56 ? GREEN : c.win <= 0.44 ? RED : INK;
  return `<tr><td class="rn">${i + 1}</td><td class="rn"><b>${NAME[id]}</b></td><td class="rn">${FN[FAC[id]]}</td><td>${t.n}</td><td style="color:${col}"><b>${p(c.win)}</b></td><td>${p(t.win)}</td><td>${p(t.avgLoss)}</td><td>${p(t.avgDealt)}</td><td>${p(t.hiRate)}</td><td>${avg(e, (x) => x.tier).toFixed(1)}</td><td>${p(avg(e, (x) => (x.tier >= 3 && x.t3pl2 ? 1 : 0)))}</td><td>${avg(e, (x) => x.roster).toFixed(1)}</td><td>${avg(e, (x) => x.hulls).toFixed(1)}</td></tr>`; }).join('')}
</table><div class="cap">Ranked by win rate against the other three factions. Green 56% or more, red 44% or less. End columns averaged at the close of turn ${turns}.</div>`;

// scenarios by faction, and attack/defence
const scenFac = `<div class="sec"><div class="ct">Each faction by scenario (against the other factions)</div><table class="g"><tr><th></th>${SCEN.map((s) => `<th>${SN[s]}</th>`).join('')}</tr>
${FACS.map((f) => `<tr><td class="rn"><b>${FN[f]}</b></td>${SCEN.map((s) => cell(S((r) => r.fm === f && r.cross && r.scen === s))).join('')}</tr>`).join('')}</table></div>`;
const RK = ['invasion/attacker', 'invasion/defender', 'demolish/attacker', 'demolish/defender', 'takeover/attacker', 'takeover/defender'];
const rkName = (k) => SN[k.split('/')[0]] + ' ' + (k.split('/')[1] === 'attacker' ? 'atk' : 'def');
const roleFac = `<div class="sec"><div class="ct">Each faction attacking and defending (against the other factions)</div><table class="g"><tr><th></th>${RK.map((k) => `<th>${rkName(k)}</th>`).join('')}</tr>
${FACS.map((f) => `<tr><td class="rn"><b>${FN[f]}</b></td>${RK.map((k) => cell(S((r) => r.fm === f && r.cross && r.scen === k.split('/')[0] && r.role === k.split('/')[1]))).join('')}</tr>`).join('')}</table>
<div class="cap">All battles together: ${['invasion', 'demolish', 'takeover'].map((s) => { const a = S((r) => r.scen === s && r.role === 'attacker'); return SN[s] + ' attacker ' + p(a.win); }).join(' · ')}.</div></div>`;
let ps = `<div class="sec"><div class="ct">Each personality by scenario (all opponents)</div><table class="g"><tr><th></th>${SCEN.map((s) => `<th>${SN[s]}</th>`).join('')}</tr>`;
FACS.forEach((f) => { ps += facRow(f); IDS.filter((id) => FAC[id] === f).forEach((id) => { ps += `<tr><td class="rn">${NAME[id]}</td>${SCEN.map((s) => cell(S((r) => r.me === id && r.scen === s))).join('')}</tr>`; }); });
ps += `</table></div>`;
let pr = `<div class="sec"><div class="ct">Each personality attacking and defending (all opponents)</div><table class="g"><tr><th></th>${RK.map((k) => `<th>${rkName(k)}</th>`).join('')}</tr>`;
FACS.forEach((f) => { pr += facRow(f); IDS.filter((id) => FAC[id] === f).forEach((id) => { pr += `<tr><td class="rn">${NAME[id]}</td>${RK.map((k) => cell(S((r) => r.me === id && r.scen === k.split('/')[0] && r.role === k.split('/')[1]), 10)).join('')}</tr>`; }); });
pr += `</table></div>`;
// by battle tier
const TIERS = [1, 2, 3, 4].filter((t) => sides.some((r) => r.tier === t && r.cross));
const tierFac = `<div class="sec"><div class="ct">Each faction by Battle Tier (against the other factions)</div><table class="g"><tr><th></th>${TIERS.map((t) => `<th>Tier ${['', 'I', 'II', 'III', 'IV'][t]}</th>`).join('')}</tr>
${FACS.map((f) => `<tr><td class="rn"><b>${FN[f]}</b></td>${TIERS.map((t) => cell(S((r) => r.fm === f && r.cross && r.tier === t))).join('')}</tr>`).join('')}</table></div>`;
let tp = `<div class="sec"><div class="ct">Company Tier through the campaign (average)</div><table class="num"><tr><th class="rn">Personality</th>${marks.map((t) => `<th>Turn ${t}</th>`).join('')}</tr>`;
FACS.forEach((f) => { tp += facRow(f); IDS.filter((id) => FAC[id] === f).forEach((id) => { tp += `<tr><td class="rn">${NAME[id]}</td>${marks.map((t) => `<td>${tierAt(id, t).toFixed(1)}</td>`).join('')}</tr>`; }); });
tp += `</table></div>`;
// best and worst match-ups (personality against personality)
const mu = [];
IDS.forEach((a) => IDS.forEach((b) => { if (a < b && FAC[a] !== FAC[b]) { const t = S((r) => r.me === a && r.foe === b); if (t.n >= 20) mu.push([a, b, t]); } }));
mu.sort((x, y) => Math.abs(y[2].win - 0.5) - Math.abs(x[2].win - 0.5));
const muT = `<div class="sec"><div class="ct">The most one-sided cross-faction match-ups (20 battles or more)</div><table class="num"><tr><th class="rn">Winner</th><th class="rn">over</th><th>Win rate</th><th>Battles</th></tr>
${mu.slice(0, 16).map(([a, b, t]) => { const [w, l, r] = t.win >= 0.5 ? [a, b, t.win] : [b, a, 1 - t.win]; return `<tr><td class="rn"><b>${NAME[w]}</b> (${FN[FAC[w]]})</td><td class="rn">${NAME[l]} (${FN[FAC[l]]})</td><td>${p(r)}</td><td>${t.n}</td></tr>`; }).join('')}</table>
<div class="cap">About ${Math.round(avg(mu, (m) => m[2].n))} battles per pairing, so ±${Math.round(100 / Math.sqrt(avg(mu, (m) => m[2].n)))} points is noise on any one of them.</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>All-faction world simulation</title><style>
@page { size: A4; margin: 12mm 11mm; }
body { font-family: Inter, Helvetica, Arial, sans-serif; color: ${INK}; font-size: 9.5pt; line-height: 1.38; }
h1 { font-size: 18pt; margin: 0 0 3px; } h2 { font-size: 14pt; margin: 16px 0 6px; } h2.pb { break-before: page; }
.by { color: ${DIM}; margin-bottom: 10px; } .cap { color: ${DIM}; font-size: 8pt; margin: 3px 0 10px; } .ct { font-weight: 600; margin: 8px 0 3px; }
.sec { break-inside: avoid; } table { border-collapse: collapse; width: 100%; } td, th { padding: 2px 5px; border-bottom: 1px solid #e6e6e1; text-align: center; font-size: 8.3pt; }
th { font-weight: 600; } td.rn, th.rn { text-align: left; white-space: nowrap; } td small { color: #444; font-size: 6.8pt; display: block; } td.na { color: #aaa; background: ${EMPTY}; font-size: 7pt; }
.tot { border-left: 2px solid #ccc; } .num td:not(.rn) { text-align: right; } tr.fh td { background: #e9e9e4; font-weight: 700; font-size: 8pt; padding: 2px 5px; }
</style></head><body>
<h1>All-faction world simulation</h1>
<div class="by">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${runs.length} campaigns × ${turns} turns · ${L.length} battles</div>
<p>Each campaign is a world of 24 AI companies: all six personalities of each of the four factions (PMC, Rebels, Bugs, Xenotripods), founded together. Every campaign turn the 24 pair off at random into twelve battles, played in full by the engine with the AI on both sides, on a random planet and scenario; attacker and defender are rolled as in the game. The full campaign aftermath and each company's own development follow every battle. The Battle Tier is the lower of the two companies' fieldable Tiers. ${p(L.filter((b) => b.fA !== b.fB).length / L.length)} of battles were between two factions; the rest were within one.</p>
<p>The figure that matters most is the <b>win rate against the other factions</b>: within-faction battles always add up to 50% for that faction. Draws were ${p(all.d / all.n)}. "Lost" is the share of a side's models (machines whole) lost in the battle; high-loss is 40% or more. Battles lost to engine errors: ${runs.reduce((s, r) => s + r.errors.length, 0)}; battles not played (no legal army or unfinished): ${runs.length * turns * 12 - L.length - runs.reduce((s, r) => s + r.errors.length, 0)}.</p>
${changeSec}
<h2 class="pb">Factions</h2>
${fvf}${scenFac}${roleFac}${tierFac}
<h2 class="pb">All 24 personalities</h2>
${ov}
${muT}
<h2 class="pb">Personalities against factions</h2>
${pvf}
<h2 class="pb">Scenarios and roles by personality</h2>
${ps}${pr}
<h2 class="pb">Progress</h2>
${tp}
</body></html>`;
fs.writeFileSync(OUT.replace(/\.pdf$/, '.html'), html);
(async () => { const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined }); const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.pdf({ path: OUT, format: 'A4', printBackground: true }); await b.close(); console.log('wrote', OUT, 'battles', L.length); })();
