/* What is said in a story battle (src/story/deep-contract-talk.js; story.js
   talkFor; engine/storybattle.js storyTalk): the lines a battle is handed, its
   own first and its enemy's otherwise, by what has happened; and in the
   battle, each put up once, on a card with who says it, when its moment comes;
   and the allies, reporting in and answering their orders. */
'use strict';
const { C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
const dc = S.get('deep-contract');
function at(node, flags) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'deep-contract', { commander: 'Mara Quill' });
  c.story.chapter = node.split('.')[0]; c.story.node = node;
  Object.assign(c.story.flags, flags || {});
  return c;
}
const talkAt = (node, flags) => S.talkFor(at(node, flags), S.battleSpec(at(node, flags)));

console.log('\nThe lines a battle is handed');
let t = talkAt('c1.battle');
const start = t.find((l) => l.on === 'start');
ok('Hold the Port opens with its own words: the port master, or the Front at the fence',
  start && ['okonkwo', 'fighter'].indexOf(start.who) >= 0 && dc.talk.battles['c1.battle'].start.some((l) => l.who === start.who), JSON.stringify(start));
ok('...and for what it has none of its own, the Front’s', ['kill', 'loss', 'bhalf', 'ahalf'].every((m) => t.some((l) => l.on === m)));
ok('...nothing it cannot happen in: no waves, no talks, no target', !t.some((l) => ['wave', 'parley', 'target'].indexOf(l.on) >= 0));
ok('each with who says it, their name and what they are', t.every((l) => dc.people[l.who] && l.name === dc.people[l.who].name && typeof l.role === 'string'));
ok('...written out: no braces, the commander named', t.every((l) => !/[{}]/.test(l.text)) &&
  [...Array(30)].map(() => talkAt('c1.battle').find((l) => l.on === 'turn3')).every((l) => /Quill/.test(l.text)));
t = talkAt('revenge.battle', { varga_dead: true });
ok('by what has happened, before anything else: Varga dead, the Front speaks for her', [...Array(20)].every(() => /Varga/.test(talkAt('revenge.battle', { varga_dead: true }).find((l) => l.on === 'start').text)));
ok('...the school shelled, Pit Nine says so', [...Array(20)].every(() => /school/.test(talkAt('c4.battle', { pit9_shelled: true }).find((l) => l.on === 'start').text)));
t = talkAt('holdline.battle', { truce: true });
ok('...in a truce, Varga holds the pass beside you', t.find((l) => l.on === 'start').who === 'varga');
t = talkAt('hiveheart.battle');
ok('the hive: chittering and the company net, and the waves', t.some((l) => l.on === 'wave') && t.every((l) => ['hive', 'ops'].indexOf(l.who) >= 0));
const people = new Set();
[dc.talk.sides, dc.talk.battles].forEach((g) => Object.keys(g).forEach((k) => Object.keys(g[k]).forEach((m) => g[k][m].forEach((l) => people.add(l.who)))));
ok('everyone who speaks is one of the story’s people, with a face', [...people].every((w) => dc.people[w] && dc.people[w].face), [...people].join(', '));
ok('every battle it names is one of the story’s', Object.keys(dc.talk.battles).every((k) => dc._nodes[k] || (k.indexOf('@side:') === 0 && dc.side.jobs.some((j) => '@side:' + j.id === k))));

console.log('\nThe arrival: the story opens on a conversation');
{
  const k = at('c1.brief'), v = S.view(k);
  ok('Landfall’s first page opens with the ship’s captain reporting in orbit', v.id === 'c1.brief' && v.talk && v.talk[0].who === 'captain' && /orbit/.test(v.talk[0].text));
  ok('...HTX’s director setting out the job, the port master on the radio last', v.talk.some((l) => l.who === 'liaison') && v.talk[v.talk.length - 1].who === 'okonkwo');
  ok('...and the commander answering, by rank and name, for the company', v.talk.some((l) => l.who === 'commander' && /Quill/.test(l.name) && l.role === k.companies.A.name));
  ok('...written out, and every speaker one of the story’s people', v.talk.every((l) => !/[{}]/.test(l.text) && dc.people[l.who]));
  ok('a page with no conversation has none', !S.view(at('c1.portmaster')).talk);
}

console.log('\nSaid in the battle');
function deployAndStart(e) {
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
const c = at('c1.battle');
const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: 'secure' });
const cfg = L.toCfg(c, { picks, role: 'A' });
cfg.mode = 'demo';
const cards = [];
const e = Engine.create({ card: (k) => { if (k.talk) cards.push({ k, turn: e.state().turn }); } });
e.start(cfg); deployAndStart(e);
for (let i = 0, stuck = 0; i < 20000 && !e.over(); i++) {
  const st = e.state();
  if (st.swapAsk) { e.intent(st.swapAsk.side, { k: 'swapdone' }); continue; }
  if (st.faceAsk) { e.intent(st.faceAsk.side, { k: 'vfaceall' }); continue; }
  if (e.intent(st.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
  if (++stuck > 20) break;
}
const st = e.state();
const first = cards[0];
ok('the battle opens with its first line, on turn 1', first && first.k.talk.who && first.turn === 1 && first.k.note === cfg.story.talk.find((l) => l.on === 'start').text, first && first.k.title);
ok('...a card with who says it: their face, by the story and the speaker', cards.every((x) => x.k.kind === 'Comms' && x.k.talk.story === 'deep-contract' && dc.people[x.k.talk.who]));
const said = Object.keys(st.talkSaid || {});
ok('each line said once at most, and only when its moment came', cards.length === said.length && new Set(cards.map((x) => x.k.note)).size === cards.length, said.join(', '));
const lost = (side) => st.units.some((u) => u.side === side && !u.ally && !u.alive && !u.extracted);
ok('...the first kill and the first loss among them, where they happened', (!lost('B') || said.indexOf('kill') >= 0) && (!lost('A') || said.indexOf('loss') >= 0), 'over on turn ' + st.turn);
ok('...and each written to the battle log', cards.every((x) => st.log.some((l) => l.text.indexOf(x.k.note) >= 0)));
ok('a battle with nothing to say says nothing', (() => {
  const e2 = Engine.create({ card: (k) => { if (k.talk) cards2.push(k); } }), cards2 = [];
  const cfg2 = JSON.parse(JSON.stringify(cfg)); cfg2.story.talk = [];
  e2.start(cfg2); deployAndStart(e2);
  for (let i = 0; i < 200 && !e2.over(); i++) if (!e2.intent(e2.state().activeSide || 'A', { k: 'step' }).ok) break;
  return cards2.length === 0;
})());

console.log('\nThe allies: they report in, and answer their orders');
{
  const k = C.newCampaign({ mode: 'solo' });
  C.found(k.companies.A, FOUNDING, 'S2');
  S.begin(k, 'deep-contract', { commander: 'Mara Quill' });
  S.proceed(k); S.choose(k, 'take');                  // Landfall, the port master's men taken on
  const kc = L.toCfg(k, { picks: C.pickForce(k.companies.A, 1, 1, null, { scenario: 'secure' }), role: 'A' });
  const rep = kc.story.talk[0];
  ok('with allies, the battle’s first line is theirs, reporting in: port security, at the terminal', rep && rep.on === 'allies' && rep.who === 'portguard' && /terminal/.test(rep.text), JSON.stringify(rep));
  ok('...and their words for each order, written out', ['move', 'attack', 'hold', 'clear'].every((x) => kc.story.allyVoice[x].length && kc.story.allyVoice[x].every((t) => !/[{}]/.test(t))));
  ok('without allies, nothing of theirs', !cfg.story.allyVoice && !cfg.story.talk.some((l) => l.on === 'allies'));
  const said2 = [];
  const k2 = Engine.create({ card: (x) => { if (x.talk) said2.push(x); } });
  kc.mode = 'ai'; k2.start(kc); deployAndStart(k2);
  for (let i = 0; i < 400 && !said2.length; i++) if (!k2.intent(k2.state().activeSide || 'A', { k: 'step' }).ok) break;
  ok('in the battle, they report in first, as it opens', said2[0] && said2[0].talk.who === 'portguard' && said2[0].note === rep.text, said2[0] && said2[0].note);
  const ks = k2.state();
  ks.phase = 'battle'; ks.over = null;
  const before = said2.length;
  k2.intent('A', { k: 'allyorder', kind: 'hold', x: 24, y: 24 });
  k2.intent('A', { k: 'allyorder', kind: 'attack', x: 30, y: 24 });
  const answers = said2.slice(before);
  ok('an order given: they answer it, on a card of their own', answers.length === 2 && kc.story.allyVoice.hold.indexOf(answers[0].note) >= 0 && kc.story.allyVoice.attack.indexOf(answers[1].note) >= 0,
    answers.map((x) => x.note).join(' | '));
  k2.intent('A', { k: 'allyorder', kind: null });
  ok('...and withdrawn, they say they will use their own judgement', said2.length === before + 3 && kc.story.allyVoice.clear.indexOf(said2[said2.length - 1].note) >= 0);
  k2.intent('A', { k: 'allyorder', kind: 'move', x: -3, y: 24 });
  ok('an order not given (off the table) is not answered', said2.length === before + 3);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
