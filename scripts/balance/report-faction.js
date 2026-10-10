// The one-faction report (run by report.js).
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { C } = require(path.join(__dirname, '../../server/rules.js'));
const OUT = process.env.OUT;
const DIR = process.env.DIR, FACTION = process.env.FACTION || 'pmc', FNAME = { pmc: 'PMC', rebel: 'Rebel', xeno: 'Xenotripod', bugs: 'Bug' }[FACTION];
const runs = fs.readdirSync(DIR).filter((f) => /^run\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(DIR + '/' + f)));
const IDS = runs[0].end.map((e) => e.arch), NAME = {};
IDS.forEach((id) => { NAME[id] = C.archetype(id).name; });
const SCEN = ['meeting', 'secure', 'find', 'invasion', 'demolish', 'takeover'];
const SCEN_NAME = { meeting: 'Meeting engagement', secure: 'Secure the area', find: 'Find and retrieve', invasion: 'Invasion', demolish: 'Demolition', takeover: 'Takeover' };
const GREEN = '#2f9e5b', RED = '#d0473a', INK = '#1d1d1b', DIM = '#6b6b66', EMPTY = '#f1f1ee';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const p = (x) => Math.round(100 * x) + '%';
const L = runs.flatMap((r) => r.log);
// one row per side of each battle
const sides = [];
L.forEach((b) => {
  ['A', 'B'].forEach((sd) => {
    const me = b[sd], foe = b[sd === 'A' ? 'B' : 'A'];
    sides.push({ me, foe, scen: b.scenario, role: b.atk ? (b.atk === me ? 'attacker' : 'defender') : null, res: b.winner == null ? 'd' : b.winner === me ? 'w' : 'l',
      loss: sd === 'A' ? b.lossA : b.lossB, dealt: sd === 'A' ? b.lossB : b.lossA, turn: b.turn, tier: b.tier, mirror: me === foe,
      tac: sd === 'A' ? b.tacA : b.tacB, foeTac: sd === 'A' ? b.tacB : b.tacA });
  });
});
function tally(rows) { const t = { n: rows.length, w: 0, d: 0, l: 0, loss: 0, dealt: 0, hi: 0 }; rows.forEach((r) => { t[r.res]++; t.loss += r.loss; t.dealt += r.dealt; if (r.loss >= 0.4) t.hi++; });
  t.win = t.n ? t.w / t.n : 0; t.avgLoss = t.n ? t.loss / t.n : 0; t.avgDealt = t.n ? t.dealt / t.n : 0; t.hiRate = t.n ? t.hi / t.n : 0; return t; }
const S = (f) => tally(sides.filter(f));
function cell(t, min) {
  if (!t || t.n < (min || 10)) return `<td class="na">${t && t.n ? 'n' + t.n : ''}</td>`;
  const d = t.win - 0.5, a = Math.min(0.75, Math.abs(d) * 2.2), col = d >= 0 ? GREEN : RED;
  return `<td style="background:${col}${Math.round(a * 255).toString(16).padStart(2, '0')}"><b>${p(t.win)}</b><small>${p(t.avgLoss)} lost · n${t.n}</small></td>`;
}
function grid(title, rows, rowName, get, note) {
  let h = `<div class="sec"><div class="ct">${title}</div><table class="g"><tr><th></th>${IDS.map((id) => `<th>${NAME[id]}</th>`).join('')}</tr>`;
  rows.forEach((r) => { h += `<tr><td class="rn">${esc(rowName(r))}</td>${IDS.map((id) => cell(get(id, r))).join('')}</tr>`; });
  return h + `</table><div class="cap">${note}</div></div>`;
}
// head to head: row vs column (mirror matches excluded)
let h2h = `<div class="sec"><div class="ct">Head to head: the row's win rate against the column</div><table class="g"><tr><th></th>${IDS.map((id) => `<th>vs ${NAME[id]}</th>`).join('')}<th class="tot">vs all</th></tr>`;
IDS.forEach((a) => {
  h2h += `<tr><td class="rn"><b>${NAME[a]}</b></td>${IDS.map((b) => a === b ? '<td class="na">—</td>' : cell(S((r) => r.me === a && r.foe === b))).join('')}${cell(S((r) => r.me === a && !r.mirror)).replace('<td', '<td class="tot"')}</tr>`;
});
h2h += `</table><div class="cap">Each cell: the row personality's win rate against the column, its average own loss, and battles. Green above 50%, red below. With one company of each personality, no personality ever meets itself.</div></div>`;
// tier progression
const turns = runs[0].turns, marks = [4, 8, 12, 16, 20, 24].filter((t) => t <= turns);
const tierAt = (id, t) => { const i = IDS.indexOf(id); const v = runs.map((r) => r.tiers[t - 1][i]); return v.reduce((s, x) => s + x, 0) / v.length; };
const ends = {}; IDS.forEach((id) => { ends[id] = runs.map((r) => r.end.find((e) => e.arch === id)); });
const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
function strengths(id) {
  const base = S((r) => r.me === id).win, out = { s: [], w: [] };
  const add = (label, t) => { if (t.n < 20) return; const d = t.win - base; const line = `${label}: wins ${p(t.win)} (n${t.n}), ${p(t.avgLoss)} lost`; if (d >= 0.1) out.s.push([d, line]); if (d <= -0.1) out.w.push([d, line]); };
  SCEN.forEach((s) => add(SCEN_NAME[s], S((r) => r.me === id && r.scen === s)));
  ['invasion', 'demolish', 'takeover'].forEach((s) => ['attacker', 'defender'].forEach((ro) => add(SCEN_NAME[s] + ' as ' + ro, S((r) => r.me === id && r.scen === s && r.role === ro))));
  IDS.filter((b) => b !== id).forEach((b) => add('Against ' + NAME[b], S((r) => r.me === id && r.foe === b)));
  if (FACTION === 'rebel') ['wave', 'laststand', 'guerillas'].forEach((t) => add('Taking ' + { wave: 'Human Wave', laststand: 'Last Stand', guerillas: 'Guerillas' }[t], S((r) => r.me === id && r.tac === t)));
  out.s.sort((x, y) => y[0] - x[0]); out.w.sort((x, y) => x[0] - y[0]);
  return { s: out.s.slice(0, 6).map((x) => x[1]), w: out.w.slice(0, 6).map((x) => x[1]) };
}

const TAC = ['wave', 'laststand', 'guerillas'], TACN = { wave: 'Human Wave', laststand: 'Last Stand', guerillas: 'Guerillas' };
function tacticSection() {
  let h = `<h2 class="pb">Rebel Tactics</h2>`;
  h += grid('Win rate by the tactic taken', TAC, (t) => TACN[t], (id, t) => S((r) => r.me === id && r.tac === t), 'Each cell: win rate when the personality took that tactic, average own loss, battles.');
  h += `<div class="sec"><div class="ct">How often each personality takes each tactic</div><table class="num"><tr><th class="rn">Personality</th>${TAC.map((t) => `<th>${TACN[t]}</th>`).join('')}</tr>
  ${IDS.map((id) => { const all = sides.filter((r) => r.me === id).length; return `<tr><td class="rn">${NAME[id]}</td>${TAC.map((t) => `<td>${p(sides.filter((r) => r.me === id && r.tac === t).length / all)}</td>`).join('')}</tr>`; }).join('')}</table></div>`;
  h += `<div class="sec"><div class="ct">Tactic against tactic (all six together): the row's win rate against the column</div><table class="g"><tr><th></th>${TAC.map((t) => `<th>vs ${TACN[t]}</th>`).join('')}</tr>
  ${TAC.map((a) => `<tr><td class="rn"><b>${TACN[a]}</b></td>${TAC.map((b) => a === b ? cell(S((r) => r.tac === a && r.foeTac === b)).replace(/<b>[^<]*<\/b>/, '<b>—</b>') : cell(S((r) => r.tac === a && r.foeTac === b))).join('')}</tr>`).join('')}</table>
  <div class="cap">The diagonal is always 50% (both sides took it), shown for its losses.</div></div>`;
  return h;
}
// the run before, to compare against (PREV: its directory)
function prevSides(dir) {
  const rr = fs.readdirSync(dir).filter((f) => /^run\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(dir + '/' + f)));
  const out = [];
  rr.flatMap((r) => r.log).forEach((b) => ['A', 'B'].forEach((sd) => { const me = b[sd]; out.push({ me, res: b.winner == null ? 'd' : b.winner === me ? 'w' : 'l', loss: sd === 'A' ? b.lossA : b.lossB, tac: sd === 'A' ? b.tacA : b.tacB, role: b.atk ? (b.atk === me ? 'attacker' : 'defender') : null }); }));
  return { sides: out, runs: rr };
}
const PREV = process.env.PREV ? prevSides(process.env.PREV) : null;
function changeSection() {
  const tP = (f) => { const r = PREV.sides.filter(f), t = { n: r.length, w: r.filter((x) => x.res === 'w').length, loss: r.reduce((a, x) => a + x.loss, 0), hi: r.filter((x) => x.loss >= 0.4).length }; t.win = t.n ? t.w / t.n : 0; t.avgLoss = t.n ? t.loss / t.n : 0; t.hiRate = t.n ? t.hi / t.n : 0; return t; };
  const dv = (a, b, good) => { const x = Math.round(100 * (a - b)); return `<span style="color:${Math.abs(x) < 4 ? DIM : (x > 0) === good ? GREEN : RED}">${x > 0 ? '+' : ''}${x}</span>`; };
  let h = `<h2>What changed since the last run</h2><p>${process.env.PREV_NOTE || ''} The run before: ${PREV.runs.length} campaigns. Changes of a few points are within noise.</p>
  <div class="sec"><table class="num"><tr><th class="rn">Personality</th><th>Won</th><th>Before</th><th>Change</th><th>Avg own loss</th><th>Before</th><th>High-loss battles</th><th>Before</th></tr>
  ${IDS.map((id) => { const a = S((r) => r.me === id), b = tP((r) => r.me === id); return `<tr><td class="rn"><b>${NAME[id]}</b></td><td>${p(a.win)}</td><td>${p(b.win)}</td><td>${dv(a.win, b.win, true)}</td><td>${p(a.avgLoss)}</td><td>${p(b.avgLoss)}</td><td>${p(a.hiRate)}</td><td>${p(b.hiRate)}</td></tr>`; }).join('')}</table></div>`;
  if (FACTION === 'rebel') h += `<div class="sec"><div class="ct">Each personality's win rate by tactic, now (before)</div><table class="num"><tr><th class="rn">Personality</th>${TAC.map((t) => `<th>${TACN[t]}</th>`).join('')}</tr>
  ${IDS.map((id) => `<tr><td class="rn">${NAME[id]}</td>${TAC.map((t) => { const a = S((r) => r.me === id && r.tac === t), b = tP((r) => r.me === id && r.tac === t); return `<td>${a.n >= 15 ? p(a.win) : '–'} <small style="display:inline">(${b.n >= 15 ? p(b.win) : '–'})</small></td>`; }).join('')}</tr>`).join('')}
  <tr><td class="rn"><b>All six</b></td>${TAC.map((t) => { const a = S((r) => r.tac === t), b = tP((r) => r.tac === t); return `<td><b>${p(a.win)}</b> <small style="display:inline">(${p(b.win)})</small> ${dv(a.win, b.win, true)}</td>`; }).join('')}</tr></table>
  <div class="cap">A tactic shown only with 15 or more battles. Across all six, a tactic's win rate is against everyone else's tactics.</div></div>`;
  return h;
}
const all = S(() => true);
let html = `<!doctype html><html><head><meta charset="utf-8"><title>${FNAME} world campaign simulation</title><style>
@page { size: A4; margin: 12mm 11mm; }
body { font-family: Inter, Helvetica, Arial, sans-serif; color: ${INK}; font-size: 9.5pt; line-height: 1.38; }
h1 { font-size: 18pt; margin: 0 0 3px; } h2 { font-size: 14pt; margin: 16px 0 6px; } h2.pb { break-before: page; } h3 { font-size: 11pt; margin: 10px 0 3px; }
.by { color: ${DIM}; margin-bottom: 10px; } .cap { color: ${DIM}; font-size: 8pt; margin: 3px 0 10px; } .ct { font-weight: 600; margin: 8px 0 3px; }
.sec { break-inside: avoid; } table { border-collapse: collapse; width: 100%; } td, th { padding: 3px 5px; border-bottom: 1px solid #e6e6e1; text-align: center; font-size: 8.5pt; }
th { font-weight: 600; } td.rn, th.rn { text-align: left; white-space: nowrap; } td small { color: #444; font-size: 7pt; display: block; } td.na { color: #aaa; background: ${EMPTY}; font-size: 7pt; }
.tot { border-left: 2px solid #ccc; } ul { margin: 3px 0 6px 16px; padding: 0; } li { margin: 1px 0; } .two { display: flex; gap: 14px; } .two > div { flex: 1; }
.s li::marker { color: ${GREEN}; } .w li::marker { color: ${RED}; } .num td:not(:first-child) { text-align: right; } .pers { break-inside: avoid; margin-bottom: 8px; }
</style></head><body>
<h1>${FNAME} world campaign simulation</h1>
<div class="by">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${runs.length} campaigns × ${turns} turns · ${L.length} battles</div>
<h3>How it was run</h3>
<p>Each campaign is a world of six AI companies, one of each ${FNAME} personality (${IDS.map((id) => NAME[id]).join(', ')}), founded together and fighting only each other. Every campaign turn the six pair off at random into three battles, played in full by the engine with the AI on both sides, on a random planet and scenario; attacker and defender are rolled as in the game${FACTION === 'pmc' ? " (Cavalry's doctrine S1 makes it the attacker on a 2–6)" : ''}.${FACTION === 'rebel' ? ' Each revolt then takes its Rebel Tactic (p. 95) as the AI does in the game, by its personality and its part — attacking, defending or meeting in the open — with the odd surprise.' : ''} After each battle the full campaign aftermath is applied to both companies (pay, casualties, experience, salvage, traumas), then each company's own AI development. The Battle Tier is the lower of the two companies' fieldable Tiers, at the highest Priority Level both can fill.</p>
<p>Every battle has one winner and one loser among these six (draws were ${p(all.d / all.n)}), so <b>50% is the line</b>: green is better, red worse. "Lost" is the share of a side's models (machines whole) lost in the battle; a high-loss battle is one with 40% or more lost.</p>
${PREV ? changeSection() : ''}
<h2>Overview</h2>
<table class="num"><tr><th class="rn">Personality</th><th>Battles</th><th>Won</th><th>Drawn</th><th>Lost</th><th>Avg own loss</th><th>Avg loss inflicted</th><th>High-loss battles</th><th>Company Tier at end</th><th>Dead on memorial</th><th>Roster at end</th><th>Hulls at end</th></tr>
${IDS.map((id) => { const t = S((r) => r.me === id), e = ends[id]; return `<tr><td class="rn"><b>${NAME[id]}</b></td><td>${t.n}</td><td>${p(t.w / t.n)}</td><td>${p(t.d / t.n)}</td><td>${p(t.l / t.n)}</td><td>${p(t.avgLoss)}</td><td>${p(t.avgDealt)}</td><td>${p(t.hiRate)}</td><td>${avg(e, (x) => x.tier).toFixed(1)}</td><td>${avg(e, (x) => x.memorial).toFixed(0)}</td><td>${avg(e, (x) => x.roster).toFixed(1)}</td><td>${avg(e, (x) => x.hulls).toFixed(1)}</td></tr>`; }).join('')}
</table><div class="cap">Averaged over ${runs.length} campaigns; the end columns at the close of turn ${turns}.</div>
${h2h}
<div class="sec"><div class="ct">Company Tier through the campaign (average)</div><table class="num"><tr><th class="rn">Personality</th>${marks.map((t) => `<th>Turn ${t}</th>`).join('')}<th>At T3 PL2 by the end</th></tr>
${IDS.map((id) => `<tr><td class="rn">${NAME[id]}</td>${marks.map((t) => `<td>${tierAt(id, t).toFixed(1)}</td>`).join('')}<td>${p(avg(ends[id], (x) => (x.tier >= 3 && x.t3pl2 ? 1 : 0)))}</td></tr>`).join('')}
</table><div class="cap">Each company fights about once a turn.</div></div>
<h2 class="pb">Scenarios and roles</h2>
${grid('Win rate by scenario', SCEN, (s) => SCEN_NAME[s], (id, s) => S((r) => r.me === id && r.scen === s), 'Each cell: win rate, average own loss, battles.')}
${grid('Attacking and defending', ['invasion/attacker', 'invasion/defender', 'demolish/attacker', 'demolish/defender', 'takeover/attacker', 'takeover/defender'], (k) => SCEN_NAME[k.split('/')[0]] + ' — ' + k.split('/')[1], (id, k) => S((r) => r.me === id && r.scen === k.split('/')[0] && r.role === k.split('/')[1]), 'All six together: ' + ['invasion', 'demolish', 'takeover'].map((s) => SCEN_NAME[s] + ' attacker ' + p(S((r) => r.scen === s && r.role === 'attacker').win) + ' / defender ' + p(S((r) => r.scen === s && r.role === 'defender').win)).join(' · ') + '.')}
<div class="sec"><div class="ct">How often each personality attacks (Invasion, Demolition, Takeover)</div><table class="num"><tr><th class="rn">Personality</th><th>As attacker</th><th>As defender</th><th>Share attacking</th></tr>
${IDS.map((id) => { const a = S((r) => r.me === id && r.role === 'attacker'), d = S((r) => r.me === id && r.role === 'defender'); return `<tr><td class="rn">${NAME[id]}</td><td>${a.n}</td><td>${d.n}</td><td>${p(a.n / Math.max(1, a.n + d.n))}</td></tr>`; }).join('')}
</table></div>
${FACTION === 'rebel' ? tacticSection() : ''}
<h2 class="pb">Personalities</h2>
${IDS.map((id) => { const t = S((r) => r.me === id), sw = strengths(id), docs = {}; ends[id].forEach((e) => e.doctrines.forEach((d) => { docs[d] = (docs[d] || 0) + 1; }));
  return `<div class="pers"><h3>${NAME[id]}</h3><p>Wins ${p(t.win)}, loses ${p(t.l / t.n)}; average own loss ${p(t.avgLoss)}, inflicted ${p(t.avgDealt)}; ${p(t.hiRate)} of battles with heavy losses. Ends the campaign at Company Tier ${avg(ends[id], (x) => x.tier).toFixed(1)} with ${avg(ends[id], (x) => x.roster).toFixed(1)} units (${avg(ends[id], (x) => x.hulls).toFixed(1)} hulls) and ${avg(ends[id], (x) => x.kUC).toFixed(1)} kUC.</p>
  <div class="two"><div class="s"><div class="ct">Strengths</div><ul>${sw.s.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>None stands out by 10 points or more.</li>'}</ul></div><div class="w"><div class="ct">Weaknesses</div><ul>${sw.w.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>None stands out by 10 points or more.</li>'}</ul></div></div>
  <div class="cap">Against its own ${p(t.win)} win rate; at least 20 battles. Doctrines held at the end: ${Object.entries(docs).sort((x, y) => y[1] - x[1]).map(([k, c]) => k + ' ' + c + '/' + ends[id].length).join(', ')}.</div></div>`; }).join('')}
</body></html>`;
fs.writeFileSync(OUT.replace(/\.pdf$/, '.html'), html);
(async () => { const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined }); const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.pdf({ path: OUT, format: 'A4', printBackground: true }); await b.close(); console.log('wrote', OUT, 'battles', L.length); })();
