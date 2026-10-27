/* Unknown contacts (storybattle.js contacts; docs/story-dead-reckoning-plan.md
   section 0): Dead Reckoning's first half meets the Xenotripods without a name
   for them. At the Drowned Beacon the Red Reavers dig, and once the lodestone
   is found, or by turn 4, the Reavers break and run and something steps out of
   the air by the objective: side B's from then on, known only as an unknown
   contact. The Reavers who ran are fled, not lost, and the battle goes on. */
'use strict';
const { R, C, SC, Engine } = require('../../server/rules.js');
const S = require('../../src/story/story.js');
const L = require('../../src/story/levers.js');
require('../../src/story/dead-reckoning.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}
const FOUNDING = ['recruits', 'enforcers', 'irregulars', 'mortarsection', 'lpv', 'unarmoured', 'rookie', 'lighteng'];
function started(chapter, node, mode) {
  const c = C.newCampaign({ mode: 'solo' });
  C.found(c.companies.A, FOUNDING, 'S2');
  S.begin(c, 'dead-reckoning', {});
  c.story.chapter = chapter; c.story.node = node;
  const cfg = L.toCfg(c, { picks: C.pickForce(c.companies.A, 1, 1, null, {}), role: 'A' });
  cfg.mode = mode || 'ai';
  const e = Engine.create();
  e.start(cfg);
  for (let i = 0; i < 8 && e.state().phase !== 'battle'; i++) {
    const s = e.state();
    if (s.swapAsk) e.intent(s.swapAsk.side, { k: 'swapdone' });
    e.intent('A', { k: 'autosplit' }); e.intent('B', { k: 'autosplit' });
    e.intent('A', { k: 'autodeploy' }); e.intent('B', { k: 'autodeploy' }); e.intent('A', { k: 'start' });
  }
  return { c, cfg, e, st: e.state() };
}
function endPhase(s) {
  const K = global.PMCEngineStory({ R, SC, get state() { return s; }, logLine() {}, pushRes() {}, makeUnit: Engine.makeUnit || null });
  return K;
}

console.log('\nThe Drowned Beacon');
{
  const { cfg, st, e } = started('c3', 'c3.battle', 'demo');
  ok('fought against the Red Reavers, for the lodestone, with contacts to come', cfg.story.side === 'reavers' || cfg.nameB === 'The Red Reavers',
    cfg.nameB);
  ok('...the contacts by turn 4 or once it is found', cfg.story.variant.contacts && cfg.story.variant.contacts.turn === 4 && cfg.story.variant.contacts.found && cfg.story.variant.relic);
  ok('...and no Xenotripod on the table at the start', !st.units.some((u) => u.faction === 'xeno'), st.units.filter((u) => u.side === 'B').map((u) => u.key).join(' '));
  const humans = st.units.filter((u) => u.side === 'B' && u.alive).length;
  // to turn 4's End phase, the engine's own way: the AI plays both sides
  for (let i = 0, stuck = 0; i < 30000 && !e.over() && !(st.sc.contacts); i++) {
    const t = e.state();
    if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
    if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
  const s = e.state();
  ok('they came, by turn 4 at the latest', !!s.sc.contacts && s.sc.contacts.turn <= 4, s.sc.contacts ? 'turn ' + s.sc.contacts.turn : 'over: ' + (s.over && s.over.text));
  if (s.sc.contacts) {
    const ran = s.units.filter((u) => u.side === 'B' && u.fled);
    const k = s.units.filter((u) => u.unknown);
    ok('...the Reavers still on the table broke and ran: fled, not lost', ran.length > 0 && ran.every((u) => u.extracted && !u.alive && !u.unknown), ran.length + ' of ' + humans);
    ok('...and in their place, side B’s, two more than the Tier: unknown contacts, nameless', k.length === Math.min(4, (cfg.tier || 1) + 2) && k.every((u) => u.side === 'B' && u.name === 'Unknown contact' &&
      /^Unknown contact \d \[B\]$/.test(u.label) && /^x/.test(u.key) && u.alive && u.x >= 0), k.map((u) => u.label + ' ' + u.key).join(', '));
    ok('...standing by the objective', k.every((u) => R.inches(u.x, u.y, s.objectives[0].x, s.objectives[0].y) < 10));
    ok('...and the Reavers running is no rout: the battle goes on', !s.over || s.sc.contacts.turn >= 4 || !/routs/.test(s.over.text));
    ok('...side B is the unknown contacts now, and the Reavers who ran and fell are out of its tally', s.cfg.nameB === 'Unknown contacts' && s.units.filter((u) => u.side === 'B' && !u.unknown).every((u) => u.superseded));
    ok('the moment is said: contact', (cfg.story.talk || []).some((l) => l.on === 'contact') && (s.talkSaid || {}).contact != null);
  }
}

console.log('\nThe contacts give up only for their own losses');
{
  const { e, st } = started('c3', 'c3.battle', 'demo');
  const step = (until) => {
    for (let i = 0, stuck = 0; i < 40000 && !e.over() && !until(); i++) {
      const t = e.state();
      if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
      if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
      if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
      if (++stuck > 20) break;
    }
  };
  step(() => !!st.sc.contacts);
  const s = e.state();
  if (s.sc.contacts && !e.over()) {
    /* the Reavers who ran are gone from the table, every one of them (as if side B had lost the lot),
       and the contacts fresh: at the next End phase, late enough for an AI to yield, they carry on */
    s.units.filter((u) => u.side === 'B' && u.superseded).forEach((u) => { u.startSize = Math.max(u.startSize || u.models || 1, 8); });
    s.units.filter((u) => u.unknown).forEach((u) => { u.alive = true; u.models = u.startSize; });
    s.turn = Math.max(s.turn, 5);
    const t0 = s.turn;
    step(() => e.state().turn > t0);
    ok('the Reavers who ran are not the contacts’ losses: no surrender while the contacts stand', !(e.state().log || []).some((l) => /Unknown contacts surrenders/.test(l.text || '')),
      (e.state().over && e.state().over.text) || 'turn ' + e.state().turn);
  } else ok('the contacts come, and carry on: no surrender for the Reavers who ran', false, s.over && s.over.text);
}

console.log('\nAI against AI, to the end');
{
  const { e, st: s } = started('c3', 'c3.battle', 'demo');
  for (let i = 0, stuck = 0; i < 40000 && !e.over(); i++) {
    const t = e.state();
    if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
    if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
  ok('the beacon plays to an end', !!e.over(), (s.over && s.over.text) + ' (turn ' + s.turn + ')' + (s.sc.contacts ? ', contacts turn ' + s.sc.contacts.turn : ', no contacts'));
}
{
  const { e, st: s, cfg } = started('warren', 'warren.battle', 'demo');
  ok('Beyond the gate: the Reavers in the tunnels, the walls’ keepers by turn 3', cfg.nameB === 'The Red Reavers' && cfg.story.variant.contacts.turn === 3 && !s.units.some((u) => u.faction === 'xeno'));
  for (let i = 0, stuck = 0; i < 40000 && !e.over(); i++) {
    const t = e.state();
    if (t.swapAsk) { e.intent(t.swapAsk.side, { k: 'swapdone' }); continue; }
    if (t.faceAsk) { e.intent(t.faceAsk.side, { k: 'vfaceall' }); continue; }
    if (e.intent(t.activeSide || 'A', { k: 'step' }).ok) { stuck = 0; continue; }
    if (++stuck > 20) break;
  }
  ok('...and plays to an end, the contacts having come if it lasted to turn 3', !!e.over() && (s.turn < 3 || !!s.sc.contacts), (s.over && s.over.text) + ' (turn ' + s.turn + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
