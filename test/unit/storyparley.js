/* A Parley's talks (story.js parleyFor; engine/storybattle.js parleyOpen and
   parleySay): the conversation at the start of the battle, played as a chat.
   What has happened in the story opens and shuts its lines and answers; each
   answer moves Trust and Tension; an agreement ends the battle won, with the
   terms in the report and then in the story's flags; talks that break leave
   both sides where they stand, and it is a fight. A side A the AI plays
   talks it out by itself; a battle with no conversation written has a plain
   one. */
'use strict';
const { R, C, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/deep-contract.js');
const dr = require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
const dc = S.get('deep-contract');
function at(story, node, flags, meters) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, story, { commander: 'Mara Quill' });
  const def = S.get(story);
  c.story.chapter = def._nodes[node]._chapter; c.story.node = node;
  Object.assign(c.story.flags, flags || {});
  Object.assign(c.story.meters, meters || {});
  return c;
}
function started(c, mode, levers) {
  if (levers) c.story.pending = levers;
  const picks = C.pickForce(c.companies.A, 1, 1, null, { scenario: 'parley' });
  const cfg = L.toCfg(c, { picks, role: 'A' });
  cfg.mode = mode || 'ai';
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return e;
}
const textOf = (pr, step) => pr.steps[step].say.map((l) => l.text).join(' | ');
const answers = (pr, step) => pr.steps[step].options.map((o) => o.text);
// answer by the start of the answer's words
const say = (e, start) => {
  const ask = e.state().parleyAsk, o = ask && ask.options.find((x) => x.text.indexOf(start) === 0);
  return o ? e.intent('A', { k: 'parley', i: o.i }) : { ok: false, why: 'no answer "' + start + '"' };
};

console.log('\nWritten from what has happened');
{
  const spec = (c) => S.battleSpec(c);
  let c = at('deep-contract', 'ceasefire.battle', { varga_free: true, pit9_shelled: true });
  let pr = S.parleyFor(c, spec(c));
  ok('the Ceasefire is talked with Varga, while she is out there', pr.them === 'varga' && pr.steps.open.say[0].name === 'Ada Varga');
  ok('...and she starts with Pit Nine, shelled: an apology on offer, or not', /Pit Nine/.test(textOf(pr, 'open')) && answers(pr, 'open').some((t) => /my mistake/.test(t)));
  c = at('deep-contract', 'ceasefire.battle', { pit9_spared: true });
  pr = S.parleyFor(c, spec(c));
  ok('with Varga gone, it is the Front; and Pit Nine spared is remembered', pr.them === 'front' && /held your fire/.test(textOf(pr, 'open')) && !answers(pr, 'open').some((t) => /my mistake/.test(t)));
  ok('...what the company saw below opens an answer, and only then', !answers(pr, 'grievance').some((t) => /I’ve been down there/.test(t)) &&
    answers(S.parleyFor(at('deep-contract', 'ceasefire.battle', { hive_known: true }), spec(at('deep-contract', 'ceasefire.battle', { hive_known: true }))), 'grievance').some((t) => /I’ve been down there/.test(t)));
  c = at('deep-contract', 'ceasefire.battle', { core_recovered: true });
  ok('the Deep Contract files can be offered only by a company that has them', answers(S.parleyFor(c, spec(c)), 'terms').some((t) => /Deep Contract files/.test(t)) &&
    !answers(pr, 'terms').some((t) => /Deep Contract files/.test(t)));
  ok('...each line written out, with who says it: the commander by rank and name', S.parleyFor(c, spec(c)).steps.open.options[0].line.name === 'Second Lieutenant Quill');
}

console.log('\nTalked out: an agreement');
{
  const c = at('deep-contract', 'ceasefire.battle', { varga_free: true, hive_known: true });
  const e = started(c), s = e.state();
  ok('as turn 1 opens the talks are asked of side A, and nothing moves meanwhile', s.phase === 'battle' && s.turn === 1 && !!s.parleyAsk && s.parleyAsk.options.length >= 3 &&
    s.units.every((u) => !u.activated));
  ok('...an answer that needs more trust than there is is shut', (() => {
    s.parleyAsk.step = 'terms'; s.parleyAsk.options = s.parleyAsk.options.slice(0, 0);
    const want = s.cfg.story.parley.steps.terms.options.findIndex((o) => o.need > 0);
    const r = e.intent('A', { k: 'parley', i: want });
    s.parleyAsk.step = 'open'; s.parleyAsk.options = s.cfg.story.parley.steps.open.options.map((o, i) => ({ i, text: o.text, locked: o.need > 0 }));
    return !r.ok;
  })());
  say(e, 'Tell me why you rose');
  ok('an answer: the commander says it, they answer, and Trust moves', s.parleyAsk.trust === 1 && s.parleyAsk.log.some((l) => l.who === 'commander') && s.parleyAsk.step === 'grievance');
  say(e, 'I’ve been down there');
  say(e, 'My people home alive');
  ok('...Trust enough, and the real offer is open', s.parleyAsk.trust >= 2 && s.parleyAsk.options.some((o) => /Seal the shafts/.test(o.text) && !o.locked), 'trust ' + s.parleyAsk.trust);
  say(e, 'Seal the shafts');
  ok('agreed: the battle is over, won by side A, without a shot', !!e.over() && s.over.winner === 'A' && !s.parleyAsk, s.over && s.over.text);
  ok('...the terms in the report', s.storyOutcome && s.storyOutcome.parley === 'agreed' && s.storyOutcome.terms.indexOf('terms_shafts') >= 0);
  const rep = { winner: 'A', routed: {}, story: s.storyOutcome, units: s.units.filter((u) => !u.spawned).map((u) => ({ side: u.side, tier: u.tier, startSize: u.models, endSize: u.models })) };
  S.resolveBattle(c, rep);
  ok('...and in the story: the truce, and the terms kept as flags', c.story.flags.truce && c.story.flags.terms_shafts);
}

console.log('\nTalked out: a fight');
{
  const c = at('deep-contract', 'ceasefire.battle', { pit9_shelled: true });
  const e = started(c), s = e.state();
  say(e, 'Pit Nine was a war');
  say(e, 'Every company cuts pay');
  ok('Tension mounts with every hard answer', s.parleyAsk && s.parleyAsk.tension >= 4, s.parleyAsk && 'tension ' + s.parleyAsk.tension);
  say(e, 'I want the Front off the roads');
  ok('...and at its limit the talks break: both sides where they stand, and it is a fight', !s.parleyAsk && s.sc.parley.broken && s.sc.parley.by === 'talks' && !e.over() && s.phase === 'battle',
    JSON.stringify(s.sc.parley.talked && s.sc.parley.talked.result));
  ok('...the report says the talks broke down', s.storyOutcome && s.storyOutcome.parley === 'broke down');
  ok('...the turn goes on: the AI may act now', s.sc.parley.talked.result === 'broken' && e.state().turn === 1);
}

console.log('\nThe other two, and a parley with nothing written');
{
  let c = at('deep-contract', 'revenge.battle', { varga_dead: true });
  let pr = S.parleyFor(c, S.battleSpec(c));
  ok('Under a White Flag, after Varga: her body asked for, and given or not', /her body/.test(textOf(pr, 'want')) && answers(pr, 'want').some((t) => /her body/.test(t)));
  c = at('deep-contract', 'showdown.battle', { lantern_mercy: true, truce: true });
  pr = S.parleyFor(c, S.battleSpec(c));
  ok('Last Words: Black Lantern remembers the refinery, and with a truce the miners can be asked after', pr.them === 'actual' && /refinery/.test(textOf(pr, 'open')) && answers(pr, 'offer').some((t) => /miners/.test(t)));
  // (the Speaker's and Vane's are written now: Debts, talked out instead of fought, is not)
  c = at('dead-reckoning', 'debts.battle');
  c.story.pending = { scenario: 'parley' };
  pr = S.parleyFor(c, S.battleSpec(c));
  ok('a parley with no conversation written has a plain one: a grievance, a view, an offer, an end', pr && pr.steps.open && pr.steps.offer && pr.steps.deal.end === 'agreed' && pr.steps.fight.end === 'broken');
}

console.log('\nThe AI talks it out');
{
  let agreed = 0, broke = 0;
  for (let n = 0; n < 6; n++) {
    const e = started(at('deep-contract', 'ceasefire.battle', { varga_free: true }), 'demo'), s = e.state();
    if (s.storyOutcome && s.storyOutcome.parley === 'agreed') agreed++;
    else if (s.sc.parley.talked) broke++;
  }
  ok('side A played by the AI: talked out at once, to an agreement or a fight', agreed + broke === 6, agreed + ' agreed, ' + broke + ' broke');
}
{
  const e = started(at('deep-contract', 'ceasefire.battle', { varga_free: true })), s = e.state();
  ok('the talks go in a save as they stand', (() => { const j = JSON.parse(JSON.stringify(s.parleyAsk)); return j.step === 'open' && j.log.length > 0; })());
}
void R; void dc;

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
