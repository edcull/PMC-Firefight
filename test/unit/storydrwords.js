/* Dead Reckoning's first half written in full (docs/story-dead-reckoning-plan.md,
   phase 3): its words (dead-reckoning-text.js), its maps (-maps.js) and its
   voices (-talk.js). Every page, option and battle of chapters 1 to 4 and both
   one-offs has its own words, not the bible's one-liners; every voice that
   speaks is one of the story's people; every open-table battle has its own
   ground, laid sound; and the words fit what happens (a lodestone's debrief
   says whether the company has it). */
'use strict';
const { R, SC } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const dr = require('../../src/story/dead-reckoning.js');
const TEXT = global.PMCStoryText['dead-reckoning'];
const MAPS = global.PMCStoryMaps['dead-reckoning'];
const TALK = global.PMCStoryTalk['dead-reckoning'];

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FIRST = ['c1', 'c2', 'c3', 'c4', 'warren', 'doublecross'];
const chapters = FIRST.map((id) => dr._chapters[id]);
const nodes = [].concat(...chapters.map((c) => c.nodes));
const shared = dr._chapters.shared.nodes;

console.log('\nThe words');
const unwritten = [];
chapters.forEach((c) => { if (!TEXT[c.id]) unwritten.push(c.id); });
nodes.concat(shared).forEach((n) => {
  if (['brief', 'event', 'debrief', 'interlude', 'battle'].indexOf(n.type) >= 0 && !TEXT[n.id]) unwritten.push(n.id);
  (n.options || []).forEach((o) => {
    if (!TEXT[n.id + '/' + o.id]) unwritten.push(n.id + '/' + o.id);
    if (o.why && (o.cost || o.if) && !TEXT[n.id + '/' + o.id + '.why'] && !/extreme/.test(o.id) && o.id !== 'gate' && o.id !== 'sell' && !o.hire) unwritten.push(n.id + '/' + o.id + '.why');
  });
});
ok('every chapter, page and option of the first half has its own words', !unwritten.length, unwritten.slice(0, 6).join(', '));
const battles = nodes.filter((n) => n.type === 'battle');
ok('...every battle its mission name and its briefing', battles.every((n) => TEXT[n.id + '#name'] && TEXT[n.id] && n.name === TEXT[n.id + '#name']), battles.map((n) => n.id + ':' + n.name).join(', '));
ok('...and the words are laid over the working', dr._chapters.c1.intro === TEXT.c1 && dr._nodes['c1.bidding'].options[0].text === TEXT['c1.bidding/outbid']);
ok('no words for a page or option the story does not have', Object.keys(TEXT).every((k) => {
  const id = k.split(/[/#]/)[0], n = dr._nodes[id];
  if (dr._chapters[k]) return true;
  if (!n) return false;
  const o = k.indexOf('/') > 0 ? k.split('/')[1].replace('.why', '') : null;
  return !o || (n.options || []).some((x) => x.id === o);
}), Object.keys(TEXT).filter((k) => !dr._chapters[k] && !dr._nodes[k.split(/[/#]/)[0]]).join(', '));
{
  const c = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', { commander: 'Ines Okoro' });
  c.story.lastRelic = 'A';
  const had = S.render(c, TEXT['c2f.debrief']);
  c.story.lastRelic = 'B';
  ok('a lodestone’s debrief says whether the company came away with it', /yours/.test(had) && /without the lodestone/.test(S.render(c, TEXT['c2f.debrief'])));
}

console.log('\nThe voices');
const people = dr.people;
const said = [];
Object.keys(TALK.conversations).forEach((id) => TALK.conversations[id].forEach((l) => said.push({ at: id, who: l.who })));
Object.keys(TALK.battles).forEach((id) => Object.keys(TALK.battles[id]).forEach((m) => TALK.battles[id][m].forEach((l) => said.push({ at: id + '/' + m, who: l.who }))));
Object.keys(TALK.sides).forEach((id) => Object.keys(TALK.sides[id]).forEach((m) => TALK.sides[id][m].forEach((l) => said.push({ at: 'side ' + id + '/' + m, who: l.who }))));
ok('everyone who speaks is one of the story’s people, with a face', said.every((x) => people[x.who] && people[x.who].face), said.filter((x) => !people[x.who]).map((x) => x.at + ':' + x.who).join(', '));
ok('every conversation opens a page the story has', Object.keys(TALK.conversations).every((id) => dr._nodes[id] && dr._nodes[id].talk));
ok('every chapter of the first half opens on one', chapters.every((c) => c.nodes[0].talk && c.nodes[0].talk.length >= 3), chapters.filter((c) => !c.nodes[0].talk).map((c) => c.id).join(', '));
const MOMENTS = ['start', 'sighted', 'turn3', 'kill', 'loss', 'bhalf', 'ahalf', 'wave', 'parley', 'target', 'searched', 'found', 'guard'];
ok('every battle line is said at a moment the battle has', said.every((x) => !/\//.test(x.at) || MOMENTS.indexOf(x.at.split('/').pop()) >= 0 || TALK.conversations[x.at]));
ok('...every battle of the first half has its own, and every enemy side its own', battles.every((n) => TALK.battles[n.id]) &&
  battles.every((n) => TALK.sides[n.enemy.side]), battles.filter((n) => !TALK.battles[n.id] || !TALK.sides[n.enemy.side]).map((n) => n.id).join(', '));
ok('the Xenotripods speak in brackets, in every head at once', said.filter((x) => x.who === 'shkar' || x.who === 'mithdu').length > 4 &&
  [].concat(...Object.keys(TALK.sides.shkar).map((m) => TALK.sides.shkar[m])).every((l) => /^\[.*\]$/.test(l.text)));
ok('the hired companies have their voices: reporting in, and an answer to each order', ['kettle', 'kestrel', 'reavers', 'sable'].every((k) => {
  const v = TALK.allies[k]; return v && people[v.who] && ['report', 'move', 'attack', 'hold', 'clear'].every((o) => v[o] && v[o].length);
}));

console.log('\nThe maps');
const compound = (n) => SC.SCENARIOS[n.scenario] && SC.SCENARIOS[n.scenario].compound;
const open = battles.filter((n) => !compound(n));
ok('every open-table battle of the first half has its own ground', open.every((n) => n.map && MAPS[n.map]), open.map((n) => n.id + ':' + n.map).join(', '));
ok('...and the compounds none: their seed lays them', battles.filter(compound).every((n) => !n.map), battles.filter(compound).map((n) => n.id).join(', '));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
Object.keys(MAPS).forEach((k) => {
  const m = MAPS[k], ps = m.pieces;
  const bad = [];
  ps.forEach((p, i) => {
    if (!R.TERRAIN[p.kind]) bad.push(p.kind + ' is no terrain');
    if (p.x < 4 || p.x + p.w > 44) bad.push(p.kind + ' in an entry strip');
    if (p.y < 0 || p.y + p.h > 48) bad.push(p.kind + ' off the table');
    ps.forEach((q, j) => { if (j > i && overlap(p, q)) bad.push(p.kind + ' on ' + q.kind); });
  });
  (m.objectives || []).forEach((o) => ps.forEach((p) => { if (o.x > p.x - 2 && o.x < p.x + p.w + 2 && o.y > p.y - 2 && o.y < p.y + p.h + 2) bad.push(o.name + ' under ' + p.kind); }));
  const sites = (m.sites && m.sites.at) || [];
  sites.forEach((s, i) => {
    const r = { x: s.x - 2, y: s.y - 2, w: 4, h: 4 };
    ps.forEach((p) => { if (overlap({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, p)) bad.push(s.name + ' under ' + p.kind); });
    sites.forEach((t, j) => { if (j > i && Math.hypot(s.x - t.x, s.y - t.y) < 12) bad.push(s.name + ' within 12" of ' + t.name); });
    if (Math.hypot(s.x - 24, s.y - 24) > 12) bad.push(s.name + ' more than 12" from the middle');
  });
  ok(m.name + ': laid sound', !bad.length, bad.slice(0, 4).join('; '));
});
const used = (id) => battles.filter((n) => n.map === id);
ok('the Glass Flats and the Mire put their three places where the map says, for the relic', ['glassflats', 'mire'].every((k) => MAPS[k].sites.at.length === 3 && used(k).every((n) => n.scenario === 'find' && n.variant.relic)));
ok('Vesk’s square is crossed, for the Escort: Vane, to the landing field', !MAPS.vesk.objectives && used('vesk').every((n) => n.scenario === 'escort' && n.variant.escort === 'Ottilie Vane'));
ok('the docks leave the middle clear, for the warehouse Sable holds (Hostile takeover)', MAPS.docks.pieces.every((p) => !overlap(p, { x: 18, y: 18, w: 12, h: 12 })) && used('docks').every((n) => n.scenario === 'takeover'));
ok('each map’s world is its chapter’s', open.every((n) => { const ch = dr._chapters[n._chapter]; const place = n.place || ch.place; return !place || MAPS[n.map].planet === place.kind; }),
  open.map((n) => n.id + ' ' + MAPS[n.map].planet + '/' + ((n.place || dr._chapters[n._chapter].place) || {}).kind).join(', '));

console.log('\nThe star chart');
{
  const c = { companies: { A: { name: 'T', kUC: 20, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  ok('a new story: nothing visited yet, the first stop where the company is, the next heading to come', (() => { const ch = S.chart(c); return ch && ch.stops.length === 1 && ch.here === ch.stops[0].key && ch.ahead && ch.theirs === null; })());
  for (let i = 0; i < 60 && c.story.chapter !== 'c3'; i++) {
    const v = S.view(c); if (!v) break;
    if (v.type === 'event') { const o = v.options.filter((x) => x.ok); S.choose(c, (o.find((x) => x.id === 'flats') || o[0]).id); }
    else if (v.type === 'battle') S.resolveBattle(c, 'victory'); else S.proceed(c);
  }
  const ch = S.chart(c);
  ok('through chapter 2 by the Glass Flats: Vesk, Vantor III, Tessaly IV, in order, each with its kind of world', ch.stops.map((s) => s.planet).join() === 'Vesk,Vantor III,Tessaly IV' &&
    ch.stops.map((s) => s.kind).join() === 'dense,desert,jungle', ch.stops.map((s) => s.planet + '/' + s.kind).join(', '));
  ok('...the company at the last of them, and each rival where it was last met', ch.here === ch.stops[2].key &&
    ch.rivals.find((r) => r.id === 'kettle').at === ch.stops[0].key && ch.rivals.find((r) => r.id === 'wraith').at === ch.stops[1].key && !ch.rivals.find((r) => r.id === 'sable').at);
  c.story.revealed.theirs = true;
  ok('...and the rivals’ lodestones counted once they are revealed', S.chart(c).theirs === (c.story.meters.theirs || 0));
  require('../../src/view/story-chart.js');
  const html = global.PMCStoryChart.html(S.chart(c), 'dead-reckoning');
  ok('drawn: the map, the stops by name, who was met where, the lodestones', /<svg class="story-chart-map"/.test(html) && /Vantor III/.test(html) && /met Wraith Section/.test(html) && /Lodestones/.test(html));
  require('../../src/story/deep-contract.js');
  const dc = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(dc, 'deep-contract', {});
  ok('a story with no trail has no chart', S.chart(dc) === null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
