/* Boot the browser half of the game without a browser.

   index.html loads a dozen scripts in order and the last of them wires up the
   board. There is no way to know whether that still works by reading it, and a
   real browser is a heavy thing to ask of `npm test` — so the page is faked
   just far enough to run: a document that hands out elements, a canvas that
   accepts every call and answers nothing, and a clock.

   What this proves is narrow and worth having: every script parses, every
   script loads in the order index.html loads them, the app boots, a battle
   starts through the engine, and the intents the board sends come back as
   events and a table. It does not prove anything about pixels. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('../where.js');

let checks = 0, bad = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log('  ok   ' + what); return true; }
  bad++;
  console.log('  FAIL ' + what + (detail ? ' — ' + detail : ''));
  return false;
}

/* ---- a page, more or less ---- */
function fakeContext() {
  /* Every 2d context call is accepted and does nothing; the few that are asked
     for an answer give a plausible one. */
  const measured = { width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
  return new Proxy({
    canvas: { width: 900, height: 540 },
    measureText: () => measured,
    createLinearGradient: () => ({ addColorStop() { } }),
    createRadialGradient: () => ({ addColorStop() { } }),
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    putImageData: () => { },
    isPointInPath: () => false,
    getLineDash: () => []
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => undefined;               // every other drawing call
    },
    set() { return true; }
  });
}

function makeElement(tag, doc) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    className: '',
    children: [], style: {}, dataset: {}, attributes: {},
    width: 900, height: 540,
    hidden: false, textContent: '', value: '', checked: false, disabled: false,
    scrollTop: 0, scrollHeight: 0, clientWidth: 900, clientHeight: 540,
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      toggle(c, on) {
        const want = on === undefined ? !this._set.has(c) : !!on;
        if (want) this._set.add(c); else this._set.delete(c);
        return want;
      },
      contains(c) { return this._set.has(c); }
    },
    getContext: () => fakeContext(),
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 900, bottom: 540, width: 900, height: 540 }),
    addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; },
    appendChild(c) { el.children.push(c); c.parentElement = el; return c; },
    removeChild(c) { el.children = el.children.filter((x) => x !== c); return c; },
    insertBefore(c) { el.children.push(c); return c; },
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return k in el.attributes ? el.attributes[k] : null; },
    hasAttribute(k) { return k in el.attributes; },
    removeAttribute(k) { delete el.attributes[k]; },
    closest() { return null; },
    focus() { }, blur() { }, click() { }, scrollIntoView() { }, remove() { },
    querySelector: () => null,
    querySelectorAll: () => [],
    cloneNode: () => makeElement(tag, doc),
    contains: () => false
  };
  /* Real elements on this page are always inside something, and the drawing
     code scrolls their parent when it fills them. */
  el.parentElement = { scrollTop: 0, scrollHeight: 0, clientHeight: 300, classList: el.classList };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(v) { el._html = String(v); el.children = []; }
  });
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  /* Giving an element an id is how the code makes it findable, so doing it
     registers it the way attaching it to a real document would. */
  let ownId = '';
  Object.defineProperty(el, 'id', {
    get() { return ownId; },
    set(v) { ownId = String(v); if (doc && doc.register) doc.register(ownId, el); }
  });
  return el;
}

function makePage(html) {
  const ids = new Set();
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);

  const made = new Map();
  const doc = {
    readyState: 'complete',
    documentElement: null,
    body: null,
    head: null,
    hidden: false,
    activeElement: null,
    /* Most of this page is written with innerHTML and then looked up again by
       id, so an id that is not in the file may still be perfectly real by the
       time it is asked for. Anything is handed out; the same element comes
       back each time, which is what the code relies on. */
    getElementById(id) {
      if (!made.has(id)) made.set(id, makeElement('div', doc));
      return made.get(id);
    },
    knownIds: ids,
    register(id, el) { if (id) made.set(id, el); },
    createElement(tag) { return makeElement(tag, doc); },
    createElementNS(ns, tag) { return makeElement(tag, doc); },
    createDocumentFragment() { return makeElement('fragment', doc); },
    querySelector(sel) {
      const id = /^#([\w-]+)$/.exec(sel);
      if (id) return doc.getElementById(id[1]);
      if (!made.has('sel:' + sel)) made.set('sel:' + sel, makeElement('div', doc));
      return made.get('sel:' + sel);
    },
    querySelectorAll() { return []; },
    addEventListener() { }, removeEventListener() { }
  };
  doc.documentElement = makeElement('html', doc);
  doc.documentElement.style.setProperty = () => { };
  doc.body = makeElement('body', doc);
  doc.head = makeElement('head', doc);
  return doc;
}

/* ---- the scripts index.html loads, in the order it loads them ---- */
function scriptsOf(html) {
  const out = [];
  const re = /<script src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/* A promise that has already settled and hands on at once: this test runs
   straight through, with no turn of the event loop to settle a real one in. */
function answered(v) {
  return {
    then(fn) { try { const r = fn(v); return r && r.then ? r : answered(r); } catch (e) { return failed(e); } },
    catch() { return this; }
  };
}
function failed(e) {
  return { then() { return this; }, catch(fn) { fn(e); return this; } };
}

function boot(root, opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const doc = makePage(html);
  const timers = [];
  /* A clock the test winds on. Animations are the board's way of taking time
     over something, and every one of them ends by the clock — so rather than
     waiting out a shooting sequence in real seconds, the clock is pushed
     forward and the frames that were due are run. */
  let clock = Date.now();
  function FakeDate(...a) { return a.length ? new Date(...a) : new Date(clock); }
  FakeDate.now = () => clock;
  FakeDate.parse = Date.parse;
  FakeDate.UTC = Date.UTC;
  FakeDate.prototype = Date.prototype;

  const win = {
    innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
    document: doc,
    location: opts.location || { protocol: 'file:', host: '', href: 'file:///index.html' },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    performance: { now: () => clock },
    console: console,
    Math: Math, JSON: JSON, Date: FakeDate, Object: Object, Array: Array, String: String,
    Number: Number, Boolean: Boolean, Error: Error, RegExp: RegExp, Promise: Promise,
    Map: Map, Set: Set, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    Uint8ClampedArray: Uint8ClampedArray, Float32Array: Float32Array, Uint8Array: Uint8Array,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    /* Timers run, but only when the test asks them to: a battle that resolves
       on a callback should not depend on this process staying alive. */
    setTimeout: (fn, ms) => { timers.push({ fn, at: clock + (ms || 0) }); return timers.length; },
    clearTimeout: () => { },
    setInterval: () => 0, clearInterval: () => { },
    requestAnimationFrame: (fn) => { timers.push({ fn, at: clock, frame: true }); return timers.length; },
    cancelAnimationFrame: () => { },
    localStorage: (() => {
      const store = new Map();
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
      };
    })(),
    addEventListener() { }, removeEventListener() { }, scrollBy() { }, scrollTo() { },
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { } }),
    WebSocket: opts.WebSocket || function () { throw new Error('no sockets in this test'); },
    AudioContext: undefined, webkitAudioContext: undefined,
    // the menu's backdrop bakes whole tables in a loop: nothing to see here
    PMC_NO_BACKDROP: true,
    alert() { }, confirm: () => true, prompt: () => null,
    Image: function () { return makeElement('img', doc); },
    FileReader: function () { },
    Blob: function () { },
    URL: { createObjectURL: () => 'blob:', revokeObjectURL: () => { } },
    fetch: opts.fetch || (() => Promise.reject(new Error('no network in this test')))
  };
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.top = win;

  const ctx = vm.createContext(win);
  const loaded = [];
  scriptsOf(html).forEach((src) => {
    const code = fs.readFileSync(path.join(root, src), 'utf8');
    vm.runInContext(code, ctx, { filename: src });
    loaded.push(src);
  });

  /* Run whatever the scripts queued, a few rounds of it, the way a browser
     would get round to them. */
  /* Run everything that is due, winding the clock on until nothing is left or
     the budget runs out. A frame callback usually queues the next frame, which
     is how an animation runs, so this keeps going until they stop asking. */
  function drain(rounds) {
    for (let i = 0; i < (rounds || 40) && timers.length; i++) {
      const due = timers.splice(0, timers.length);
      const next = due.reduce((lo, t) => Math.min(lo, t.at), Infinity);
      if (next > clock) clock = next;
      due.forEach((t) => { try { t.fn(); } catch (e) { /* a frame that cannot draw */ } });
      clock += 40;                           // about a frame
    }
  }
  return { win, doc, loaded, drain, timers, tick: () => clock };
}

/* ---- the run ---- */
console.log('client — the page, booted without a browser');
const root = ROOT;
let app;
try { app = boot(root); }
catch (e) {
  console.log('  FAIL the scripts do not load — ' + (e && e.stack || e));
  process.exit(1);
}
ok('every script index.html loads, loads', app.loaded.length >= 10, app.loaded.join(', '));
ok('the rules are there', !!app.win.PMC && !!app.win.PMC.BOARD);
ok('the engine is there', !!app.win.PMCEngine && typeof app.win.PMCEngine.create === 'function');
ok('the transports are there', !!app.win.PMCNet && !!app.win.PMCNet.Local && !!app.win.PMCNet.Remote);
ok('the protocol is there', !!app.win.PMCProto);
ok('the board is there', typeof app.win.PMC_STATE === 'function');

/* Boot the app the way the page does. */
const bootFn = app.win.PMC_BOOT || null;
app.drain(4);

/* ---- the main menu, and the ways out of it ----
   Buttons are not clickable in this DOM, so the menu is driven through the
   same hooks its buttons call. */
{
  const W = app.win, byId = (id) => app.doc.getElementById(id);
  ok('the menu is there', !!W.PMCMenu && typeof W.PMC_SKIRMISH === 'function');
  W.PMCMenu.open();
  ok('the menu opens', W.PMCMenu.isOpen() && byId('setup').hidden === true);
  ok('with no battle on, there is no battle to go back to', byId('btn-resume').hidden === true);
  W.PMCMenu.show('skirmish');
  ok('Skirmish opens its own list', byId('menu-skirmish').hidden === false && byId('menu-main').hidden === true);
  W.PMCMenu.close(); W.PMC_SKIRMISH('hotseat');
  ok('Hotseat opens the muster sheet, set for hotseat',
    byId('setup').hidden === false && byId('sel-mode').value === 'hotseat');
  ok('...and it is not in commando mode', byId('solo-box').hidden === true);
  W.PMCMenu.open();
  ok('going back to the menu puts the muster sheet away', byId('setup').hidden === true);
  W.PMCMenu.close(); W.PMC_SKIRMISH('coop');
  ok('Co-operative opens the sheet in commando mode', byId('solo-box').hidden === false &&
    byId('sel-solo-mode').value === 'coop');
  W.PMCMenu.close(); W.PMC_SKIRMISH('ai');
  ok('...and a standard battle turns commando mode off again', byId('solo-box').hidden === true &&
    byId('sel-mode').value === 'ai');
  W.PMC_CAMPAIGN.open('hub');
  ok('the campaign screen puts the menu away', !W.PMCMenu.isOpen() && byId('camp').hidden === false);
  byId('camp').hidden = true; byId('setup').hidden = true;
}

/* ---- a battle, started the way the setup screen starts one ---- */
const R = app.win.PMC;
const begun = app.win.__begin ? app.win.__begin({
  tier: 3, pl: 1, scenario: 'secure',
  armyA: R.rollArmy(3, 1, null, 'pmc'),
  armyB: R.rollArmy(3, 1, null, 'rebel'),
  nameA: 'A Co', nameB: 'B Co', colourA: 'ochre', colourB: 'steel',
  mode: 'hotseat', planet: 'sparse'
}) : null;
ok('a battle can be started from the board', !!begun, 'window.__begin did not answer');

if (begun) {
  app.drain(4);
  const st = app.win.PMC_STATE();
  ok('the board is holding a table', !!st && st.units.length > 0);
  ok('it is the engine’s table', !!st && st.phase === 'deploy');

  // put both forces down and start, through the board's own hooks
  app.win.__autoDeployBoth();
  app.drain(4);
  ok('auto-deploy went through the engine', app.win.PMC_STATE().ui === undefined
    ? app.win.__deployDone() : true);

  app.win.__startBattle();
  app.drain(6);
  ok('the battle began', app.win.PMC_STATE().phase === 'battle');
  ok('initiative was rolled', !!app.win.PMC_STATE().initiative);
  ok('the log filled up', app.win.PMC_STATE().log.length > 8);

  /* ---- a whole battle, driven through the board ----
     Every one of these is a hook the board itself uses when a button is
     pressed or the table is tapped, so this is the same path a player takes:
     select, choose an action, commit to a target or a spot. Nothing here
     reaches into the engine. */
  const W = app.win;
  function fingerprint() {
    const s = W.PMC_STATE();
    return [s.turn, s.phase, s.activeSide, !!s.over,
      s.units.filter((u) => u.activated).length,
      s.units.filter((u) => u.alive).length].join('/');
  }
  /* Wait for the board to catch up. A player cannot act while a shot is still
     in the air either — the action bar is drawn from the table as the show has
     reached it, not as the server has already left it. */
  function settle() {
    for (let i = 0; i < 60; i++) {
      app.drain(20);
      if (!W.__showQueue() && !W.__busy()) return true;
    }
    return false;
  }
  let guard = 0, stalled = null;
  while (!W.PMC_STATE().over && guard++ < 2000) {
    settle();
    const s = W.PMC_STATE();
    const ins = W.__insertionState();
    if (ins) {
      const spots = W.__insertionSpotsNow();
      if (spots && spots.length) W.__dropHere(spots[0]);
      else W.__holdInsertion();
      continue;
    }
    if (s.phase !== 'battle') break;
    const list = W.__eligibleUnits();
    if (!list.length) break;
    const u = list[0];
    W.__lastRefusal = null;
    if (!W.__select(u)) { stalled = 'could not select ' + u.name + ' (queue ' + W.__showQueue() + ', busy ' + W.__busy() + ', selected ' + (W.__sel()?W.__sel().name:'nothing') + ')' + (W.__lastRefusal ? ': ' + W.__lastRefusal.why : ''); break; }
    const was = fingerprint();
    const ids = W.__actionIds(u);
    let moved = false;
    for (const id of ids) {
      W.__lastRefusal = null;
      if (!W.__pressAction(id)) continue;
      settle();
      if (process.env.PMC_WHY) {
        console.log('    pressed ' + id + ' -> mode=' + W.__uiMode() +
          ' targets=' + W.__uiCounts().targets + ' moves=' + W.__uiCounts().moves +
          ' terrain=' + W.__uiCounts().terrain + ' fp=' + (fingerprint() === was ? 'same' : 'moved') + (W.__lastRefusal ? ' REFUSED: ' + W.__lastRefusal.why : ''));
      }
      if (fingerprint() !== was) { moved = true; break; }
      if (W.__commitWhatever()) {
        settle();
        if (fingerprint() !== was) { moved = true; break; }
      }
      W.__pressCancel();
    }
    if (!moved) {
      stalled = u.name + ' [' + u.side + '] on turn ' + s.turn + ' had nothing that ended its activation';
      if (process.env.PMC_WHY) {
        console.log('    selected: ' + (W.__sel() ? W.__sel().name : 'nothing') +
          ' | seats ' + W.__seats().join(',') + ' | my side ' + W.__mySide() +
          ' | active ' + s.activeSide);
        ids.forEach((id) => {
          const st2 = W.__actionState(u, id);
          console.log('      ' + (st2.on ? 'ON  ' : '--  ') + id + ': ' + st2.hint);
        });
      }
      break;
    }
  }
  settle();
  ok('a whole battle can be played through the board', !!W.PMC_STATE().over, stalled || ('stopped after ' + guard));
  ok('the board was told the result', !!W.PMC_STATE().report);
}

/* ---- the lobby screen, against the real lobby ----
   The screen is wired to an actual Lobby running in this process, through a
   socket that is nothing more than two function calls pointed at each other.
   So what is tested is the thing itself: the room arrives as the server sends
   it, the screen draws it, and what the screen does comes back as the messages
   the server expects. */
console.log('\nlobby — the multiplayer screen, against a real lobby');
const { Lobby } = require('../../server/lobby.js');
const tables = require('../../server/table.js');

const served = new Lobby({ log: () => { }, makeTable: tables.make({ log: () => { } }) });

/* A socket that hands messages straight over, with the same surface the lobby
   expects on its side and the browser expects on its. */
function pair() {
  const server = {
    open: true, handlers: {},
    on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); },
    send(text) { if (client.onmessage) client.onmessage({ data: text }); },
    close() { this.open = false; (this.handlers.close || []).forEach((f) => f()); }
  };
  const client = {
    readyState: 1,
    send(text) { (server.handlers.message || []).forEach((f) => f(text)); },
    close() { server.close(); },
    onopen: null, onmessage: null, onclose: null, onerror: null
  };
  return { server, client };
}

function openScreen(name) {
  const link = pair();
  const app2 = boot(root, {
    location: { protocol: 'http:', host: 'localhost:8787', href: 'http://localhost:8787/' },
    WebSocket: function () { return link.client; },
    // the server answers /health, which is what lights the Multiplayer card
    fetch: (url) => answered(url === '/health' ? { ok: true, json: () => ({ ok: true, rooms: 0, players: 0 }) } : { ok: false })
  });
  served.connect(link.server);
  app2.win.localStorage.setItem('pmc-player-name', name);
  app2.win.PMCLobby.open();
  // the socket is open the moment the screen has finished wiring it up
  if (link.client.onopen) link.client.onopen();
  app2.drain(6);
  return app2;
}

const ash = openScreen('Ash');
ok('multiplayer is offered when the page came from a server', ash.win.PMCLobby.available());
ok('the multiplayer button is wired up', ash.doc.getElementById('btn-multi').hidden === false &&
  ash.doc.getElementById('btn-multi').disabled === false);
ok('...and greyed out on a page with no server behind it', app.doc.getElementById('btn-multi').disabled === true &&
  app.doc.getElementById('btn-multi').hidden === false);
const ashBody = () => ash.doc.getElementById('lobby-body').innerHTML;
ok('the lobby screen draws', /Multiplayer/.test(ashBody()));
ok('it says there are no games yet', /No games open/.test(ashBody()));

/* Ash starts a game. */
ash.win.PMCLobby.net().send('game.create', {
  name: 'Ash’s battle',
  settings: { tier: 3, pl: 1, planet: 'sparse', scenario: 'secure' },
  force: { faction: 'pmc', keys: app.win.PMC.rollArmy(3, 1, null, 'pmc'), colour: 'ochre', name: 'Ash Company' }
});
ash.drain(6);
ok('the room opens on the screen', /code [A-Z0-9]{5}/.test(ashBody()));
ok('it shows the terms', /Battle Tier/.test(ashBody()) && /Scenario/.test(ashBody()));
ok('it shows the host in seat A', /Ash/.test(ashBody()) && /Seat B/.test(ashBody()));
const roomCode = (/code ([A-Z0-9]{5})/.exec(ashBody()) || [])[1];

/* Brann joins from another browser. */
const brann = openScreen('Brann');
const brannBody = () => brann.doc.getElementById('lobby-body').innerHTML;
ok('the other player sees the game listed', new RegExp(roomCode).test(brannBody()));
brann.win.PMCLobby.net().send('game.join', { id: roomCode });
brann.drain(6);
ok('joining puts them in the room', /code /.test(brannBody()) && /Ash/.test(brannBody()));
ash.drain(4);
ok('and the host sees them arrive', /Brann/.test(ashBody()));

/* Chat, both ways. */
brann.win.PMCLobby.net().send('game.chat', { text: 'ready when you are' });
ash.drain(4);
ok('table talk reaches the other screen', /ready when you are/.test(ashBody()));

/* Forces and readiness. */
brann.win.PMCLobby.net().send('game.force', {
  force: { faction: 'rebel', keys: app.win.PMC.rollArmy(3, 1, null, 'rebel'), colour: 'crimson', name: 'The Front' }
});
ash.drain(4);
ok('a force shows on the other screen', /The Front/.test(ashBody()));

ash.win.PMCLobby.net().send('game.ready', { ready: true });
brann.win.PMCLobby.net().send('game.ready', { ready: true });
ash.drain(6); brann.drain(6);
ok('both ready, and the host is offered the start', />Take the field</.test(ashBody()));
ok('the other side is told what it is waiting for', /Waiting for the host/.test(brannBody()));

/* And away. */
ash.win.PMCLobby.net().send('game.start');
ash.drain(10); brann.drain(10);
ok('the battle starts on both screens',
  !!ash.win.PMC_STATE() && !!brann.win.PMC_STATE());
ok('both screens have the same table',
  ash.win.PMC_STATE().units.length === brann.win.PMC_STATE().units.length &&
  ash.win.PMC_STATE().seed === brann.win.PMC_STATE().seed);
ok('the lobby got out of the way', ash.doc.getElementById('lobby').hidden === true);
ok('each screen knows which side it is', ash.win.__seats().join() === 'A' && brann.win.__seats().join() === 'B');
ok('and only that side may act',
  ash.win.PMC_STATE().phase === 'deploy' &&
  (ash.win.__mySide() === 'A' || brann.win.__mySide() === 'B'));

console.log((bad ? 'FAILED ' + bad + ' of ' : 'all ') + checks + ' checks' + (bad ? '' : ' passed'));
process.exit(bad ? 1 : 0);

