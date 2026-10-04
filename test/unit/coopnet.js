/* A cooperative game over the network: the two players' commandos take the field
   as one side against the OpFor, which the server plays; each seat moves only its
   own units, and only on its own go; one player walking away gives it to the OpFor. */
'use strict';
const { Table } = require('../../server/table.js');
const P = require('../../src/engine/protocol.js');
const { R } = require('../../server/rules.js');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + name + (note ? '  — ' + note : ''));
}

const settings = P.cleanSettings({ kind: 'coop', tier: 3, soloScen: 's_crush', opFaction: 'rebel', planet: 'sparse' });
const seat = (name, colour) => ({ name: name, force: { faction: 'pmc', keys: [], name: name, colour: colour }, send() { }, sock: null });
const room = { id: 'COOP1', settings: settings, seats: { A: seat('Ash', 'ochre'), B: seat('Brann', 'ochre') }, everyone() { return []; }, broadcast() { } };
const t = new Table(room, null, {});
const cfg = t.buildConfig();

console.log('\nThe battle made');
ok('the terms are cooperative, under a solitaire scenario, against an insurgent OpFor', settings.kind === 'coop' && cfg.scenario === 's_crush' && cfg.solo.opFaction === 'rebel' && cfg.netCoop);
ok('each player’s commando (rolled, as none was mustered) on side A, owned by its player', cfg.armyA.length > 0 && cfg.ownersA.indexOf(1) >= 0 && cfg.ownersA.indexOf(2) >= 0);
ok('...the second in a colour of its own', cfg.colourC && cfg.colourC !== cfg.colourA, cfg.colourA + ' / ' + cfg.colourC);
// the OpFor in the colours the host picked for it in the room; never a player's
const oc = P.cleanSettings({ opColour: 'jade' }, P.cleanSettings({ kind: 'coop', tier: 3, opFaction: 'bugs' }));
const cfgO = new Table(Object.assign({}, room, { settings: oc }), null, {}).buildConfig();
ok('the OpFor wears the colours the host picked for it', oc.opColour === 'jade' && cfgO.colourB === 'jade', cfgO.colourB);
const cfgW = new Table(Object.assign({}, room, { settings: P.cleanSettings({ opColour: 'ochre' }, P.cleanSettings({ kind: 'coop' })) }), null, {}).buildConfig();
ok('...but not a colour a player wears (the board picks another)', cfgW.colourB === null, String(cfgW.colourB));
ok('...and an unknown colour is not taken', P.cleanSettings({ opColour: 'tartan' }).opColour === null && P.cleanSettings({ opColour: null }, oc).opColour === null);
t.begin(cfg);
const st = t.engine.state();
ok('the engine plays it as a cooperative game, the OpFor the machine’s', !!(st.solo && st.solo.coop) && st.cfg.aiSides.join() === 'B');
const one = st.units.filter((u) => u.side === 'A' && u.owner === 1)[0], two = st.units.filter((u) => u.side === 'A' && u.owner === 2)[0];
ok('both players’ units are there', !!one && !!two);

console.log('\nWho may do what');
const r1 = t.engine.intent('B', { k: 'select', id: one.id });
ok('Player 2 cannot touch Player 1’s units', !r1.ok && /partner/.test(r1.why || ''), r1.why);
const r2 = t.engine.intent('B', { k: 'select', id: two.id });
ok('...but their own seat acts for side A (not the OpFor’s)', !(r2.why && /partner/.test(r2.why)), r2.why || 'ok');
st.phase = 'battle'; st.activeSide = 'A'; st.activeOwner = 1;
const r3 = t.engine.intent('B', { k: 'select', id: two.id });
ok('in the battle, on Player 1’s go, Player 2 waits', !r3.ok && /partner’s go/.test(r3.why || ''), r3.why);
const r4 = t.engine.intent('A', { k: 'select', id: one.id });
ok('...and Player 1 acts', !(r4.why && /partner/.test(r4.why)), r4.why || 'ok');
ok('both seats are shown the table as side A sees it', t.sideOf('B') === 'A' && t.sideOf('A') === 'A');

console.log('\nWalking away');
ok('one player leaving gives the battle to the OpFor', t.forfeit('B') === 'B');
ok('...ended the engine\u2019s way, so the result is there to be shown', !!t.engine.over() && t.engine.over().winner === 'B' && /walks away/.test(t.engine.over().text), JSON.stringify(t.engine.over()));

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
