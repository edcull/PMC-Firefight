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
{
  // the second half too (phase 5a): every pool chapter, Recall and the end, every page, option and battle
  const second = Object.keys(dr._chapters).filter((id) => dr._chapters[id].half === 2);
  const miss = [];
  second.forEach((id) => {
    const ch = dr._chapters[id];
    if (!TEXT[id]) miss.push(id);
    ch.nodes.forEach((n) => {
      if (['brief', 'event', 'debrief', 'interlude', 'battle'].indexOf(n.type) >= 0 && !TEXT[n.id]) miss.push(n.id);
      if (n.type === 'battle' && !TEXT[n.id + '#name']) miss.push(n.id + '#name');
      (n.options || []).forEach((o) => {
        if (!TEXT[n.id + '/' + o.id]) miss.push(n.id + '/' + o.id);
        if (o.why && (o.cost || o.if) && !o.hire && !TEXT[n.id + '/' + o.id + '.why']) miss.push(n.id + '/' + o.id + '.why');
      });
    });
  });
  ok('the second half has its own words too: every chapter, page, option, reason and battle', second.length >= 17 && !miss.length, miss.slice(0, 8).join(', '));
  ok('...and opens on the name: Halloran reads it out, and the newsfeeds have it', /Xenotripods/.test(TEXT.fault) && dr._nodes['fault.brief'].talk.some((l) => l.who === 'reader' && /Xenotripods/.test(l.text)));
  const c = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  const before = S.render(c, TEXT['wreck.hatch']);
  c.story.flags.beat_sable = true;
  ok('...and a rival met again says whether it has been beaten before', /fired on/.test(before) && !/Kerrigan/.test(before) && /Kerrigan/.test(S.render(c, TEXT['wreck.hatch'])));
}
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
const MOMENTS = ['start', 'sighted', 'turn3', 'kill', 'loss', 'bhalf', 'ahalf', 'wave', 'parley', 'target', 'searched', 'found', 'guard', 'contact'];
ok('every battle line is said at a moment the battle has', said.every((x) => !/\//.test(x.at) || MOMENTS.indexOf(x.at.split('/').pop()) >= 0 || TALK.conversations[x.at]));
ok('...every battle of the first half has its own, and every enemy side its own', battles.every((n) => TALK.battles[n.id]) &&
  battles.every((n) => TALK.sides[n.enemy.side]), battles.filter((n) => !TALK.battles[n.id] || !TALK.sides[n.enemy.side]).map((n) => n.id).join(', '));
ok('the patron is a man nobody sees: Lucan Vane, on the line, half his face in shadow', people.vane.name === 'Lucan Vane' && people.vane.face.shadow === true &&
  /seen by almost nobody/.test(dr.blurb) && /nobody does/.test(TALK.conversations['c1.brief'][0].text));
{
  /* First contact: in the first half nobody knows what the Xenotripods are. No
     word names them or a tribe, no tribe speaks, and no battle is fought
     against one; what is met is unknown, speaks in brackets, and has no name. */
  const NAMES = /Xenotripod|Sh’kar|Mithdu|Hashamer|Esh-Aven|Ulvar|\bAmt\b|Crock/;
  const firstIds = new Set(nodes.map((n) => n.id).concat(FIRST));
  const named = Object.keys(TEXT).filter((k) => firstIds.has(k.split(/[/#]/)[0]) && NAMES.test(TEXT[k]));
  chapters.forEach((c) => { if (NAMES.test(c.intro || '') || NAMES.test(c.title || '')) named.push(c.id); });
  nodes.forEach((n) => { if (NAMES.test(n.text || '') || NAMES.test(n.title || '')) named.push(n.id); (n.options || []).forEach((o) => { if (NAMES.test(o.text || '')) named.push(n.id + '/' + o.id); }); });
  if (NAMES.test(dr.blurb)) named.push('blurb');
  ok('the first half never names them: no word for the Xenotripods or any tribe', !named.length, named.join(', '));
  const firstSaid = said.filter((x) => firstIds.has(x.at.split('/')[0]) || /^side (kettle|wraith|sable|scavengers|reavers)/.test(x.at));
  ok('...no tribe speaks there; what does is unknown, in brackets', firstSaid.every((x) => ['shkar', 'mithdu', 'seven'].indexOf(x.who) < 0) &&
    firstSaid.filter((x) => x.who === 'unknown').length >= 3 && [].concat(...Object.values(TALK.battles).map((b) => [].concat(...Object.values(b)))).concat(...Object.values(TALK.conversations))
    .filter((l) => l.who === 'unknown').every((l) => /^\[.*\]$/.test(l.text)), firstSaid.filter((x) => ['shkar', 'mithdu'].indexOf(x.who) >= 0).map((x) => x.at).join(', '));
  ok('...and no battle of the first half is fought against a tribe: they come only as unknown contacts', battles.every((n) => !dr.sides[n.enemy.side] || dr.sides[n.enemy.side].faction !== 'xeno') &&
    ['c3.battle', 'warren.battle'].every((id) => dr._nodes[id].variant.contacts && dr._nodes[id].variant.contacts.keys.every((k) => /^x/.test(k))),
    battles.filter((n) => dr.sides[n.enemy.side] && dr.sides[n.enemy.side].faction === 'xeno').map((n) => n.id).join(', '));
  const sideJobs = dr.side.jobs.filter((j) => j.enemy && j.enemy.faction === 'xeno');
  ok('...nor any side contract before the second half', sideJobs.every((j) => j.if && JSON.stringify(j.if).indexOf('"gte":5') >= 0 || JSON.stringify(j.if || {}).indexOf('played') >= 0), sideJobs.map((j) => j.id).join(', '));
  ok('the second half opens on the name: Morrow names them, and it is out', /Xenotripods/.test(dr._chapters.fault.intro));
}
{
  // the second half's voices (phase 5c)
  const second = Object.keys(dr._chapters).filter((id) => dr._chapters[id].half === 2 && dr._chapters[id].nodes.some((n) => n.type === 'battle'));
  const sb = [].concat(...second.map((id) => dr._chapters[id].nodes.filter((n) => n.type === 'battle')));
  ok('every chapter of the second half opens on a conversation', second.every((id) => (dr._nodes[id + '.brief'] || {}).talk && dr._nodes[id + '.brief'].talk.length >= 3),
    second.filter((id) => !((dr._nodes[id + '.brief'] || {}).talk)).join(', '));
  ok('...every battle of it has its own lines, and every side it fights its own', sb.every((n) => TALK.battles[n.id]) && sb.every((n) => !n.enemy.side || TALK.sides[n.enemy.side]),
    sb.filter((n) => !TALK.battles[n.id] || (n.enemy.side && !TALK.sides[n.enemy.side])).map((n) => n.id).join(', '));
  ok('...the tribes still in brackets, in every head at once', ['ulvar', 'amt', 'shkar', 'mithdu'].every((t) => [].concat(...Object.values(TALK.sides[t])).filter((l) => l.who === t).every((l) => /^\[.*\]$/.test(l.text))));
  ok('...and the Hashamer fight beside the company with a voice of their own: Seven-Holds-the-Staff', TALK.allies.hashamer && TALK.allies.hashamer.who === 'seven' &&
    ['report', 'move', 'attack', 'hold', 'clear'].every((o) => TALK.allies.hashamer[o].length));
  const c = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(c, 'dead-reckoning', {});
  const sp = S.parleyFor(c, { node: 'speaker.battle', enemy: { side: 'amt' } }), cl = S.parleyFor(c, { node: 'collector.battle', enemy: { side: 'lance' } });
  const reach = (pr) => { const seen = new Set(), go = (id) => { if (seen.has(id) || !pr.steps[id]) return; seen.add(id); pr.steps[id].options.forEach((o) => go(o.next)); }; go(pr.start); return seen; };
  ok('the Speaker’s talks are written: the Amt, from brackets to words, to an agreement or a fight', sp && sp.them === 'amt' && /^\[/.test(sp.steps.open.say[0].text) &&
    sp.steps.stones.say.some((l) => !/^\[/.test(l.text)) && reach(sp).has('deal') && reach(sp).has('fight') && sp.steps.deal.end === 'agreed');
  ok('...and Vane’s last terms, in person: the stones home is one of them', cl && cl.them === 'vane' && reach(cl).has('deal') && reach(cl).has('fight') &&
    Object.values(cl.steps).some((st) => st.options.some((o) => o.terms.indexOf('relics_returned') >= 0)));
  c.story.flags.beat_kestrel = true;
  c.story.chapter = 'claim'; c.story.node = 'claim.brief';
  const claim = S.view(c).talk || [];
  ok('...a rival beaten before opens on it: Kestrel, made to look slow', claim.some((l) => /look slow/.test(l.text)) && !claim.some((l) => /great pictures/.test(l.text)));
}
ok('the hired companies have their voices: reporting in, and an answer to each order', ['kettle', 'kestrel', 'reavers', 'sable'].every((k) => {
  const v = TALK.allies[k]; return v && people[v.who] && ['report', 'move', 'attack', 'hold', 'clear'].every((o) => v[o] && v[o].length);
}));

console.log('\nThe maps');
const compound = (n) => SC.SCENARIOS[n.scenario] && SC.SCENARIOS[n.scenario].compound;
// (the whole story, both halves, phase 5b: no battle left on rolled ground)
const allBattles = Object.keys(dr._nodes).map((id) => dr._nodes[id]).filter((n) => n.type === 'battle' && !n.side);
const open = allBattles.filter((n) => !compound(n));
ok('every open-table battle of the story has its own ground, both halves', open.every((n) => n.map && MAPS[n.map]), open.map((n) => n.id + ':' + n.map).join(', '));
ok('...and the compounds none: their seed lays them', allBattles.filter(compound).every((n) => !n.map), allBattles.filter(compound).map((n) => n.id).join(', '));
ok('...so nothing waits on maps to come', !dr.mapsPending);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
Object.keys(MAPS).forEach((k) => {
  const m = MAPS[k], ps = m.pieces;
  const bad = [];
  ps.forEach((p, i) => {
    if (!R.TERRAIN[p.kind]) bad.push(p.kind + ' is no terrain');
    // (a road may run to the edge: it is open ground, and the way on to the table)
    if ((p.x < 4 || p.x + p.w > 44) && p.kind !== 'road') bad.push(p.kind + ' in an entry strip');
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
const used = (id) => allBattles.filter((n) => n.map === id);
ok('the Glass Flats and the Mire put their three places where the map says, for the relic', ['glassflats', 'mire'].every((k) => MAPS[k].sites.at.length === 3 && used(k).every((n) => n.scenario === 'find' && n.variant.relic)));
{
  // Vesk as a settlement: paved roads from the table's four edges meeting in a square in the middle, round the auction house, a fountain in its corner
  const roads = MAPS.vesk.pieces.filter((p) => p.kind === 'road' && p.paved);
  const fountain = MAPS.vesk.pieces.find((p) => p.kind === 'fountain');
  const middle = MAPS.vesk.pieces.find((p) => p.kind === 'building' && p.x < 24 && p.x + p.w > 24 && p.y < 24 && p.y + p.h > 24);
  ok('Vesk is a crossroads: paved roads from all four edges of the table into a paved square, the auction house in the middle of it',
    !!middle && roads.some((p) => p.x === 0) && roads.some((p) => p.x + p.w === 48) && roads.some((p) => p.y === 0) && roads.some((p) => p.y + p.h === 48) &&
    MAPS.vesk.pieces.filter((p) => p.kind === 'building').length >= 10);
  ok('...and a fountain off a corner of the square, clear of the roads, that blocks the view across it',
    !!fountain && Math.hypot(fountain.x + fountain.w / 2 - 24, fountain.y + fountain.h / 2 - 24) > 8 && Math.hypot(fountain.x + fountain.w / 2 - 24, fountain.y + fountain.h / 2 - 24) < 14 &&
    roads.every((p) => !(p.x < fountain.x + fountain.w && fountain.x < p.x + p.w && p.y < fountain.y + fountain.h && fountain.y < p.y + p.h)) &&
    R.TERRAIN.fountain.blocks && R.TERRAIN.fountain.impassable);
ok('...its skin the market’s: railings for barricades, the market’s clutter for craters, by name too', MAPS.vesk.skin === 'market' &&
    MAPS.vesk.pieces.filter((p) => p.kind === 'barricade').length >= 4 && R.terrainName({ cfg: { story: { skin: 'market' } } }, 'barricade') === 'Railings and planters' &&
    R.terrainName({ cfg: { story: { skin: 'market' } } }, 'crater') === 'Market clutter' && R.terrainName({ cfg: { story: {} } }, 'crater') === 'Rubble and craters');
}
ok('Vesk’s square is crossed, for the Escort: Halloran, to the landing field', !MAPS.vesk.objectives && used('vesk').every((n) => n.scenario === 'escort' && n.variant.escort === 'Halloran'));
ok('the docks leave the middle clear, for the warehouse Sable holds (Hostile takeover)', MAPS.docks.pieces.every((p) => !overlap(p, { x: 18, y: 18, w: 12, h: 12 })) && used('docks').every((n) => n.scenario === 'takeover'));
ok('the second half keeps clear what its scenarios lay themselves: the takeovers’ middle, the Parley’s, Recall’s landing zone',
  ['quietfield'].every((k) => MAPS[k].pieces.every((p) => !overlap(p, { x: 18, y: 18, w: 12, h: 12 }))) &&
  MAPS.orlo.pieces.every((p) => !overlap(p, { x: 21, y: 19, w: 6, h: 10 })) &&
  MAPS.quietfog.pieces.every((p) => !overlap(p, { x: 29, y: 10, w: 9, h: 28 })) &&
  used('quietfield').every((n) => n.scenario === 'takeover') && used('orlo').every((n) => n.scenario === 'parley') && used('quietfog').every((n) => n.scenario === 'breakout'));
ok('...and the Strike’s three turrets and the Hold the Line’s beacon are where the map says', MAPS.brannock.objectives.length === 3 && MAPS.beaconlit.objectives.length === 1 &&
  used('brannock').every((n) => n.scenario === 'strike') && used('beaconlit').every((n) => n.scenario === 'holdline'));
{
  require('../../src/view/story-scenes.js');
  const SCN = global.PMCStoryScenes.SCENES;
  const chs = Object.keys(dr._chapters).filter((id) => dr._chapters[id].nodes.some((n) => n.type === 'battle'));
  ok('every map has its scene, and every chapter with a battle its card’s picture', Object.keys(MAPS).every((k) => SCN[k]) && chs.every((id) => dr._chapters[id].scene && SCN[dr._chapters[id].scene.place]),
    Object.keys(MAPS).filter((k) => !SCN[k]).concat(chs.filter((id) => !(dr._chapters[id].scene && SCN[dr._chapters[id].scene.place]))).join(', '));
}
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
  {
    // who each rival works for: a secret at first, on the chart as "client unknown", until something reveals it
    const c2 = { companies: { A: { name: 'T', kUC: 20, tier: 1, roster: [] } } };
    S.begin(c2, 'dead-reckoning', {});
    const ch0 = S.chart(c2);
    ok('every rival’s client is a secret at the start', ch0.rivals.every((r) => r.client === false), ch0.rivals.map((r) => r.id + ':' + r.client).join(' '));
    const reveals = {};
    const scan = (x, at) => { if (!x || typeof x !== 'object') return; if (typeof x.reveal === 'string' && /^client_/.test(x.reveal)) (reveals[x.reveal.slice(7)] = reveals[x.reveal.slice(7)] || []).push(at); Object.keys(x).forEach((k) => scan(x[k], at)); };
    Object.keys(dr._nodes).forEach((id) => scan(dr._nodes[id], id));
    ok('...and every one of them can be found out, with a line for the journal', Object.keys(dr.clients).every((id) => (reveals[id] || []).length) &&
      JSON.stringify(dr._nodes['c2f.drop']).indexOf('"reveal":"client_wraith","journal"') >= 0, Object.keys(dr.clients).map((id) => id + ':' + (reveals[id] || []).join('/')).join(' '));
    c2.story.revealed.client_wraith = true;
    c2.story.journal.push({ chapter: 'c2', node: 'c2f.battle', grade: 'victory' });
    const h2 = global.PMCStoryChart.html(S.chart(c2), 'dead-reckoning');
    ok('...the chart names Wraith Section’s once it is known', /Wraith Section.*for the Admiralty/.test(h2), h2.slice(h2.indexOf('chart-rivals'), h2.indexOf('chart-rivals') + 300));
    c2.story.revealed.client_wraith = false; c2.story.leading = 'kestrel';
    ok('...and says "client unknown" while it is not', /Kestrel Air Cavalry \(leading\) <small class="secret">client unknown/.test(global.PMCStoryChart.html(S.chart(c2), 'dead-reckoning')));
  }
  {
    // business until somebody loses: a rival beaten bears a grudge, in its words and at the table
    const c3 = { companies: { A: { name: 'T', kUC: 20, tier: 1, roster: [] } } };
    S.begin(c3, 'dead-reckoning', {});
    ok('no grudges at the start', !Object.keys(c3.story.flags).some((f) => /^beat_/.test(f)));
    c3.story.chapter = 'c1'; c3.story.node = 'c1.battle';
    S.resolveBattle(c3, 'victory');
    ok('Brass Ledger beaten at Vesk: it bears a grudge', c3.story.flags.beat_kettle === true && !c3.story.flags.beat_wraith);
    const later = { node: 'debts.battle', enemy: { side: 'kettle' } };   // (a battle whose own start is a plain line)
    const said = S.talkFor(c3, later), st0 = said.find((l) => l.on === 'start');
    ok('...and says so next time: Vesk, and personal', st0 && /Vesk/.test(st0.text) && /mine/.test(st0.text), st0 && st0.text);
    ok('...over a battle’s own plain line', /Vesk/.test((S.talkFor(c3, { node: 'c4.battle', enemy: { side: 'kettle' } }).find((l) => l.on === 'start') || {}).text || ''));
    ok('...and its forces come readier for it', JSON.stringify(dr.rivals.kettle.changes).indexOf('beat_kettle') >= 0);
    const fresh = { companies: { A: { name: 'T', kUC: 20, tier: 1, roster: [] } } };
    S.begin(fresh, 'dead-reckoning', {});
    ok('...where a company never beaten is still all business', !/Vesk/.test((S.talkFor(fresh, later).find((l) => l.on === 'start') || {}).text || ''));
  }
  require('../../src/story/deep-contract.js');
  const dc = { companies: { A: { name: 'T', kUC: 0, tier: 1, roster: [] } } };
  S.begin(dc, 'deep-contract', {});
  ok('a story with no trail has no chart', S.chart(dc) === null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
