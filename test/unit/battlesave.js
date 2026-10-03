/* The battle kept in this browser (hotseat review HB-12): a run of taps picking
   units is kept as the last pick that took, not every tap, and a save that
   cannot be written is said once. Several are kept, each under its own id, and
   the one an older build kept is moved in among them. */
global.window = global;
require('../../src/net/net.js');
var Local = global.PMCNet.Local;
var Engine = require('../../server/rules.js').Engine;

var pass = 0, fail = 0;
function ok(name, got, want) {
  var good = got === want;
  good ? pass++ : fail++;
  console.log('  ' + (good ? '✓' : '✗') + ' ' + name + '  — ' + got + (good ? '' : ' (expected ' + want + ')'));
}
var store = {}, full = false;
global.localStorage = {
  getItem: function (k) { return store[k] == null ? null : store[k]; },
  setItem: function (k, v) { if (full) throw new Error('QuotaExceededError'); store[k] = v; },
  removeItem: function (k) { delete store[k]; }
};

var e = Engine.create({});
e.start({ tier: 3, pl: 1, scenario: 'meeting', armyA: ['regular', 'regular'], armyB: ['regular', 'regular'],
  nameA: 'A', nameB: 'B', colourA: 'ochre', colourB: 'steel', mode: 'hotseat', planet: 'sparse' });
var l = new Local(); l.seats = ['A', 'B']; l.engine = e;
l.rolling = function (f) { return f.call(this); }; l.flush = function () { };
l.book = { v: 1, id: 'b1', cfg: { mode: 'hotseat', nameA: 'A', nameB: 'B' }, seats: ['A', 'B'], seed: 1, intents: [] };
var said = [];
l.on('unsaved', function (m) { said.push(m.text); });
var st = e.state(), mine = st.units.filter(function (u) { return u.side === 'A'; });
st.phase = 'battle'; st.activeSide = 'A';

console.log('\nPicking units, again and again');
l.intent({ k: 'select', id: mine[0].id });
l.intent({ k: 'select', id: mine[1].id });
l.intent({ k: 'select', id: mine[0].id });
ok('three picks in a row are kept as the last one', l.book.intents.length, 1);
ok('...the unit picked last', l.book.intents[0][1].id, mine[0].id);
ok('...and it is still the one selected', e.sel().selected && e.sel().selected.id, mine[0].id);
l.intent({ k: 'nosuchthing' });
l.intent({ k: 'select', id: mine[1].id });
ok('a pick after something else is kept as well', l.book.intents.length, 3);
l.intent({ k: 'select', id: 'nobody' });
ok('a pick that is refused is kept (as every refusal is)', l.book.intents.length, 4);
l.intent({ k: 'select', id: mine[0].id });
ok('...until a pick after it takes', l.book.intents.length, 4);
ok('the save holds what the book does', JSON.parse(store['pmc-battle:b1']).intents.length, 4);
ok('...and the list of battles kept names it', global.PMCNet.savedBattles().map(function (b) { return b.id + ' ' + b.nameA + ' v ' + b.nameB; }).join(), 'b1 A v B');

console.log('\nA save that cannot be written');
full = true;
l.intent({ k: 'select', id: mine[1].id });
l.intent({ k: 'nosuchthing' });
ok('is said once, not at every tap', said.length, 1);
ok('...saying a refresh would lose the battle', /refresh/.test(said[0] || ''), true);
full = false;
l.intent({ k: 'nosuchthing' });
full = true;
l.intent({ k: 'nosuchthing' });
ok('once it has saved again, a new failure is said again', said.length, 2);

console.log('\nSeveral kept');
full = false;
var l2 = new Local(); l2.seats = ['A']; l2.engine = e; l2.rolling = l.rolling; l2.flush = l.flush;
l2.book = { v: 1, id: 'b2', cfg: { mode: 'ai', nameA: 'C' }, seats: ['A'], seed: 2, intents: [] };
l2.keep();
ok('another battle is kept beside the first, the latest first', global.PMCNet.savedBattles().map(function (b) { return b.id; }).join(), 'b2,b1');
ok('each is read back by its id', global.PMCNet.savedBattle('b1').id + ' ' + global.PMCNet.savedBattle('b2').cfg.nameA, 'b1 C');
ok('with no id, the latest', global.PMCNet.savedBattle().id, 'b2');
l2.forget();
ok('one put away leaves the other', global.PMCNet.savedBattles().map(function (b) { return b.id; }).join() + ' ' + store['pmc-battle:b2'], 'b1 undefined');

console.log('\nKept by an older build');
store['pmc-live-battle'] = JSON.stringify({ v: 1, cfg: { mode: 'ai', nameA: 'Old' }, seats: ['A'], seed: 1, intents: [] });
var all = global.PMCNet.savedBattles();
ok('the one battle an older build kept is moved in among them', all.length === 2 && all.some(function (b) { return b.nameA === 'Old'; }) && store['pmc-live-battle'] === undefined, true);
var old = all.filter(function (b) { return b.nameA === 'Old'; })[0];
ok('...and plays back as before', !!global.PMCNet.savedBattle(old.id) && global.PMCNet.savedBattle(old.id).cfg.nameA, 'Old');
global.PMCNet.forgetBattle(old.id);

console.log('\nA demo is never kept');
store['pmc-live-battle'] = JSON.stringify({ v: 1, cfg: { mode: 'demo' }, seats: ['A', 'B'], seed: 1, intents: [] });
ok('a demo found kept (an older build\'s) is not offered back after a refresh', global.PMCNet.savedBattles().length, 1);
ok('...and is thrown away', store['pmc-live-battle'], undefined);
var d = new Local(); d.seats = ['A', 'B']; d.engine = e; d.book = { v: 1, id: 'd1', cfg: { mode: 'demo' }, seats: ['A', 'B'], seed: 1, intents: [] };
d.keep();
ok('a demo being watched is never written', store['pmc-battle:d1'], undefined);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
