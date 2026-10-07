/* PMC 2670 — Firefight : saved forces, wherever they are kept.

   Two kinds, from the force builder and the screens that use them:
     'skirmish'  an army list for a Battle Tier and Priority Level
                 { faction, tier, pl, tactic, colour, keys, name, saved }
     'start'     a campaign's starting company: its units and its doctrine
                 { faction, doctrine, colour, keys, name, saved }

   A player signed in to the game server keeps them on their account
   (server/app.js forcesApi), and so has them on any device. Otherwise they
   live in this browser, as the skirmish screen has always kept its forces.
   A list shows both: this browser's first, then the account's.

   Each entry in a list is { where: 'local' | 'account', ref, force }: `ref`
   names it for find and remove ('l:<index>' or 's:<id>'). The account's
   forces are fetched in the background (refresh) and kept here, so a list is
   always to hand; whoever draws one asks to be told when they arrive. */
(function (root) {
  'use strict';

  var LOCAL = { skirmish: 'pmc-forces', start: 'pmc-startforces' };
  var account = { skirmish: [], start: [] };        // the signed-in player's, as last fetched
  var waiting = [];                                  // told when the account's forces arrive

  function who() {
    var A = root.PMCAccount, w = A && A.who && A.who();
    return w && !w.guest ? w : null;
  }
  // a game server to keep them on, and a player signed in to it (a guest keeps nothing there)
  function signedIn() {
    return !!(root.PMCNet && root.PMCNet.online && root.PMCNet.online()) && !!who();
  }

  function isForce(f) { return !!f && typeof f.name === 'string' && Array.isArray(f.keys); }
  function local(kind) {
    try {
      var raw = root.localStorage.getItem(LOCAL[kind]);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(isForce) : [];
    } catch (e) { return []; }
  }
  function setLocal(kind, list) {
    try { root.localStorage.setItem(LOCAL[kind], JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  function call(method, path, body) {
    var o = { method: method, credentials: 'same-origin', cache: 'no-store' };
    if (body) { o.headers = { 'content-type': 'application/json' }; o.body = JSON.stringify(body); }
    return root.fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, code: r.status, j: j }; });
    }).catch(function () { return { ok: false, code: 0, j: { error: 'the game server could not be reached' } }; });
  }

  // the account's forces fetched again; `done` (and anyone waiting) told when they are in
  function refresh(done) {
    if (done) waiting.push(done);
    function tell() { var w = waiting; waiting = []; w.forEach(function (f) { try { f(); } catch (e) { } }); }
    if (!signedIn()) { account = { skirmish: [], start: [] }; tell(); return; }
    call('GET', 'api/forces').then(function (r) {
      var next = { skirmish: [], start: [] };
      if (r.ok && r.j && Array.isArray(r.j.forces)) {
        r.j.forces.forEach(function (f) {
          if (!next[f.kind] || !f.data) return;
          var force = Object.assign({}, f.data, { name: f.name });
          if (isForce(force)) next[f.kind].push({ id: f.id, force: force });
        });
      }
      account = next;
      tell();
    });
  }

  function list(kind) {
    var out = local(kind).map(function (f, i) { return { where: 'local', ref: 'l:' + i, force: f }; });
    if (signedIn()) out = out.concat((account[kind] || []).map(function (a) { return { where: 'account', ref: 's:' + a.id, force: a.force }; }));
    return out;
  }
  function find(kind, ref) {
    return list(kind).filter(function (e) { return e.ref === ref; })[0] || null;
  }

  /* Saved under its name: on the account when signed in, in this browser if
     not. One of the same name (any case) is replaced. `done({ ok, where, why,
     replaced })`. */
  function save(kind, force, done) {
    done = done || function () { };
    var name = String(force.name || '').trim();
    if (!name) return done({ ok: false, why: 'Give the force a name first.' });
    var f = Object.assign({}, force, { name: name, saved: new Date().toISOString().slice(0, 10) });
    if (signedIn()) {
      var was = (account[kind] || []).some(function (a) { return a.force.name.toLowerCase() === name.toLowerCase(); });
      var data = Object.assign({}, f); delete data.name;
      call('POST', 'api/forces', { kind: kind, name: name, data: data }).then(function (r) {
        if (!r.ok) return done({ ok: false, why: (r.j && r.j.error) || 'The server would not keep it.' });
        refresh(function () { done({ ok: true, where: 'account', replaced: was, ref: 's:' + r.j.id }); });
      });
      return;
    }
    var mine = local(kind), at = -1;
    mine.forEach(function (x, i) { if (x.name.toLowerCase() === name.toLowerCase()) at = i; });
    if (at >= 0) mine[at] = f; else mine.push(f);
    if (!setLocal(kind, mine)) return done({ ok: false, why: 'This browser will not let the game save.' });
    done({ ok: true, where: 'local', replaced: at >= 0, ref: 'l:' + (at >= 0 ? at : mine.length - 1) });
  }

  function remove(kind, ref, done) {
    done = done || function () { };
    var m = /^([ls]):(\d+)$/.exec(ref || '');
    if (!m) return done({ ok: false });
    if (m[1] === 'l') {
      var mine = local(kind);
      if (!mine[+m[2]]) return done({ ok: false });
      mine.splice(+m[2], 1);
      setLocal(kind, mine);
      return done({ ok: true });
    }
    call('DELETE', 'api/forces/' + m[2]).then(function (r) {
      refresh(function () { done({ ok: !!(r.ok && r.j && r.j.ok) }); });
    });
  }

  // where a save goes now, in words for the screens
  function whereWords() { return signedIn() ? 'to your account' : 'in this browser'; }

  root.PMCForces = { list: list, find: find, save: save, remove: remove, refresh: refresh,
    signedIn: signedIn, local: local, setLocal: setLocal, whereWords: whereWords, KEYS: LOCAL };
})(typeof window !== 'undefined' ? window : this);
