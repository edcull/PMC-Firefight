/* PMC 2670 — Firefight : the weapon table as this game server has it.

   How every unit is drawn firing is the weapon table in src/rules/data.js. An
   admin may change a unit's entry from the unit viewer's weapon editor; the
   game server keeps those changes (server/app.js weaponsApi) and every page it
   serves lays them over the table as it loads, so every game draws the same.
   A unit with no change fires as data.js has it, and putting a change back
   (revert) deletes it on the server. Nothing here touches the rules.

   Opened from a file or on a static site there is no server to ask: the table
   is data.js's own. */
(function (root) {
  'use strict';

  var D = root.PMCData;
  if (!D) return;
  var T = D.WEAPONS;
  // the table as data.js wrote it, so any change can always be put back
  var BASE = {};
  Object.keys(T).forEach(function (k) { BASE[k] = T[k]; });
  var changed = {};                      // key -> entry, as the server keeps them
  var loaded = false, waiting = [];

  function served() { return !!root.fetch && /^https?:$/.test((root.location || {}).protocol || ''); }
  function call(method, path, body) {
    var o = { method: method, credentials: 'same-origin', cache: 'no-store' };
    if (body) { o.headers = { 'content-type': 'application/json' }; o.body = JSON.stringify(body); }
    return root.fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, code: r.status, j: j }; });
    }).catch(function () { return { ok: false, code: 0, j: { error: 'the game server could not be reached' } }; });
  }
  function put(key, entry) { if (entry) { T[key] = entry; changed[key] = entry; } else { unput(key); } }
  function unput(key) { if (BASE[key]) T[key] = BASE[key]; else delete T[key]; delete changed[key]; }

  // the server's changes, laid over the table; `done` told once they are in (at once, with no server)
  function load(done) {
    if (done) waiting.push(done);
    function tell() { loaded = true; var w = waiting; waiting = []; w.forEach(function (f) { try { f(); } catch (e) { } }); }
    if (!served()) return tell();
    call('GET', 'api/weapons').then(function (r) {
      if (r.ok && r.j && r.j.weapons) {
        Object.keys(changed).forEach(unput);
        Object.keys(r.j.weapons).forEach(function (k) { if (BASE[k] || D.CATALOGUE.some(function (p) { return p.key === k; })) put(k, D.weaponEntry(r.j.weapons[k])); });
      }
      tell();
    });
  }
  function ready(done) { if (loaded) done(); else waiting.push(done); }

  /* An admin's change, drawn at once and kept on the server. `done({ ok, why })`:
     if the server will not keep it, the change is taken back. */
  function save(key, entry, done) {
    done = done || function () { };
    var e = D.weaponEntry(entry);
    if (!e) return done({ ok: false, why: 'That is not a weapon entry.' });
    var was = changed[key] || null;
    put(key, e);
    call('POST', 'api/weapons', { key: key, data: e }).then(function (r) {
      if (r.ok) return done({ ok: true });
      put(key, was);
      if (!was) unput(key);
      done({ ok: false, why: (r.j && r.j.error) || 'The server would not keep it.' });
    });
  }
  // a unit back as data.js has it
  function revert(key, done) {
    done = done || function () { };
    var was = changed[key] || null;
    unput(key);
    call('DELETE', 'api/weapons/' + encodeURIComponent(key)).then(function (r) {
      if (r.ok) return done({ ok: true });
      if (was) put(key, was);
      done({ ok: false, why: (r.j && r.j.error) || 'The server would not put it back.' });
    });
  }
  // every unit back as data.js has it
  function revertAll(done) {
    done = done || function () { };
    var was = Object.assign({}, changed);
    Object.keys(was).forEach(unput);
    call('DELETE', 'api/weapons').then(function (r) {
      if (r.ok) return done({ ok: true });
      Object.keys(was).forEach(function (k) { put(k, was[k]); });
      done({ ok: false, why: (r.j && r.j.error) || 'The server would not put them back.' });
    });
  }

  root.PMCWeapons = {
    load: load, ready: ready, save: save, revert: revert, revertAll: revertAll, served: served,
    base: function (key) { return BASE[key] || null; },
    isChanged: function (key) { return Object.prototype.hasOwnProperty.call(changed, key); },
    changed: function () { return Object.assign({}, changed); }
  };
  load();
})(typeof window !== 'undefined' ? window : this);
