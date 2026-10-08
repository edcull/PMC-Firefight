/* PMC 2670 — Firefight : the admin's personality editor (server tools).

   One personality at a time, read as one object (campaign.js unifiedArchetype):
   its names, how elite it is, its hulls, its temper and tactics, its doctrines,
   and its weighted list of units — a weight and a limit a Priority Level for each
   group, and for any unit in it that differs. Preview rolls forces with the
   changes in force, as they stand in the form, without saving; Save sends the
   whole personality to the server (server/archetypes.js), which keeps its
   difference from the default; Reset puts the default back.

   Mounted by account.js into the admin pane; it keeps its own state between draws. */
(function (root) {
  'use strict';
  var R = function () { return root.PMC; }, C = function () { return root.PMCCamp; };
  var state = { id: 'armour', draft: null, preview: null, note: '', fault: '', pt: 3, ppl: 2, busy: false, changed: {} };
  var api = null, host = null;
  function esc(t) { return R().esc(t); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  var FACTIONS = [['pmc', 'PMC'], ['rebel', 'Rebels'], ['bugs', 'Space Bugs'], ['xeno', 'Xenotripods']];
  var TACTICS = [['laststand', 'Last Stand'], ['wave', 'Human Wave'], ['guerillas', 'Guerillas']];

  function draft() {
    if (!state.draft || state.draft.id !== state.id) state.draft = C().unifiedArchetype(state.id);
    return state.draft;
  }
  function faction() { return draft().faction || 'pmc'; }
  // the weight and limit an entry carries: a number, or [weight, limit]
  function parts(v) { return v == null ? { w: '', l: '' } : Array.isArray(v) ? { w: v[0], l: v[1] == null ? '' : v[1] } : { w: v, l: '' }; }
  function joinParts(w, l) {
    if (w === '' || w == null || isNaN(+w)) return null;
    return l === '' || l == null || isNaN(+l) ? +w : [+w, +l];
  }
  /* A starting list for a personality still on the older rules (groups, mix, limits,
     second choices): its groups weighted by its mix, its second choices and favoured
     units now and then, its limits as limits a Priority Level. */
  function fromOlder(u) {
    var f = u.force || {}, w = {}, mix = f.mix || {}, lim = f.limit || {};
    (f.groups || []).forEach(function (g) { w[g] = mix[g] ? Math.min(10, Math.round(mix[g] * 2) + 2) : 3; });
    (f.second || []).forEach(function (g) { if (w[g] == null) w[g] = 1; });
    (f.units || []).forEach(function (k) { w[k] = 4; });
    ((f.signature && f.signature.units) || []).forEach(function (s) { (Array.isArray(s) ? s : [s]).forEach(function (k) { if (w[k] == null) w[k] = 3; }); });
    Object.keys(lim).forEach(function (k) { var p = parts(w[k]); w[k] = lim[k] === 0 ? 0 : [p.w === '' ? 3 : p.w, Math.max(1, Math.round(lim[k] / 3))]; });
    return w;
  }

  // the fields the form above does not show, in the nested shape
  var SHOWN = { force: ['weights', 'tier', 'hulls'], battle: ['temper', 'tactics'], doctrines: ['fixed', 'shortlist'] };
  function advancedOf(u) {
    var out = { blurb: u.blurb };
    ['force', 'battle', 'doctrines'].forEach(function (sec) {
      var rest = {};
      Object.keys(u[sec] || {}).forEach(function (k) { if (SHOWN[sec].indexOf(k) < 0) rest[k] = u[sec][k]; });
      if (Object.keys(rest).length) out[sec] = rest;
    });
    if (u.campaign) out.campaign = u.campaign;
    return out;
  }
  function html() {
    var u = draft(), f = u.force || {}, b = u.battle || {}, d = u.doctrines || {}, list = R().listFor(faction());
    var h = '<div class="ae">';
    // which one
    h += '<div class="ae-top"><select class="tin" data-ae="pick">' + FACTIONS.map(function (fa) {
      return '<optgroup label="' + fa[1] + '">' + C().archetypesFor(fa[0]).filter(function (a) { return (a.faction || 'pmc') === fa[0]; }).map(function (a) {
        return '<option value="' + a.id + '"' + (a.id === state.id ? ' selected' : '') + '>' + esc(a.name) + (state.changed[a.id] ? ' •' : '') + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '</select>' + (state.changed[state.id] ? '<small class="ae-tag">changed by ' + esc(state.changed[state.id].by || 'an admin') + '</small>' : '<small class="ae-tag ae-dim">default</small>') + '</div>';
    if (state.fault) h += '<p class="faults">' + esc(state.fault) + '</p>';
    if (state.note) h += '<p class="acct-notice">' + esc(state.note) + '</p>';
    // who it is
    h += '<div class="ae-grid">' +
      '<label>Name<input class="tin" data-ae-f="name" value="' + esc(u.name || '') + '" maxlength="60"></label>' +
      '<label class="ae-wide">Company names (one per line)<textarea class="tin" data-ae-f="names" rows="3">' + esc((u.names || []).join('\n')) + '</textarea></label>' +
      '<label>Tier preference<select class="tin" data-ae-f="tier">' + [[-1, '−1 fills up a Tier below'], [0, '0 its own Tier'], [1, '+1 reaches a Tier above']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((f.tier || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Hulls a Priority Level, fewest<input class="tin" type="number" min="0" max="3" step="0.5" data-ae-f="hmin" value="' + (f.hulls && f.hulls.min != null ? f.hulls.min : '') + '" placeholder="1"></label>' +
      '<label>Hulls a Priority Level, most<input class="tin" type="number" min="0" max="3" step="0.5" data-ae-f="hmax" value="' + (f.hulls && f.hulls.max != null ? f.hulls.max : '') + '" placeholder="1.5"></label>' +
      '<label>Temper (behaviour roll)<select class="tin" data-ae-f="temper">' + [-3, -2, -1, 0, 1, 2, 3].map(function (n) {
        return '<option value="' + n + '"' + ((b.temper || 0) === n ? ' selected' : '') + '>' + (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + '</option>'; }).join('') + '</select></label>' +
      '</div>';
    // tactics: a Rebel's
    if (faction() === 'rebel') {
      var t = b.tactics || {};
      h += '<div class="ae-sec"><h4>Rebel Tactics</h4>' + ['open', 'attack', 'defend'].map(function (role) {
        var have = [].concat(t[role] || []);
        return '<div class="ae-tac"><span>' + ({ open: 'In the open', attack: 'Attacking', defend: 'Defending' })[role] + '</span>' + TACTICS.map(function (x) {
          return '<label><input type="checkbox" data-ae-tac="' + role + '" value="' + x[0] + '"' + (have.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>';
        }).join('') + '</div>';
      }).join('') + '<small class="ae-dim">Two ticked: a coin toss between them. None: the usual (Human Wave, and Last Stand on defence).</small></div>';
    }
    // doctrines
    var creed = C().creedOf({ faction: faction() }).list;
    h += '<div class="ae-sec"><h4>Doctrines</h4><div class="ae-grid">' +
      '<label>Fixed (taken first)<input class="tin" data-ae-f="fixed" value="' + esc((d.fixed || []).join(', ')) + '" placeholder="e.g. T4"></label>' +
      '<label class="ae-wide">Shortlist (in order)<input class="tin" data-ae-f="shortlist" value="' + esc((d.shortlist || []).join(', ')) + '"></label></div>' +
      '<small class="ae-dim">' + creed.map(function (x) { return x.id + ' ' + esc(x.name); }).join(' · ') + '</small></div>';
    // the weighted list
    var w = f.weights || null;
    h += '<div class="ae-sec"><h4>Weighted list</h4>';
    if (!w) h += '<p class="ae-dim">This one still rolls by its groups and mix (the older rules). <button type="button" class="lnk" data-ae="convert">Start a weighted list from them</button></p>';
    else {
      h += '<small class="ae-dim">Weight 0–10 (blank: not listed, 0: never). Limit: the most a Priority Level, for a group its whole group. A unit’s own entry beats its group’s.</small>';
      var groups = {};
      list.forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
      h += '<table class="ae-w"><tr><th></th><th>Weight</th><th>Limit</th></tr>' + Object.keys(groups).map(function (g) {
        var gp = parts(w[g]);
        var row = '<tr class="ae-g"><td>' + esc(g) + '</td><td><input class="tin" type="number" min="0" max="10" data-ae-w="' + esc(g) + '" value="' + gp.w + '"></td><td><input class="tin" type="number" min="0" max="9" data-ae-l="' + esc(g) + '" value="' + gp.l + '"></td></tr>';
        return row + groups[g].sort(function (a, b2) { return a.tier - b2.tier; }).map(function (p) {
          var pp = parts(w[p.key]);
          return '<tr class="ae-u"><td>' + esc(p.name) + ' <small>' + R().ROMAN[p.tier] + (p.cls !== 'infantry' ? ' · ' + p.cls : '') + '</small></td><td><input class="tin" type="number" min="0" max="10" data-ae-w="' + p.key + '" value="' + pp.w + '" placeholder="' + gp.w + '"></td><td><input class="tin" type="number" min="0" max="9" data-ae-l="' + p.key + '" value="' + pp.l + '" placeholder="' + gp.l + '"></td></tr>';
        }).join('');
      }).join('') + '</table>';
    }
    h += '</div>';
    /* everything else, as it is kept: the campaign's founding and spending, the signature
       units and favourite hulls, the staged doctrines, and the older group rules */
    var adv = advancedOf(u);
    h += '<div class="ae-sec"><h4>Advanced</h4><details' + (state.advOpen ? ' open' : '') + ' data-ae="adv"><summary class="ae-dim">Campaign founding and spending, signature units, favourite hulls, riders, staged doctrines, the older group rules (JSON)</summary>' +
      '<textarea class="tin ae-json" data-ae-f="advanced" rows="14" spellcheck="false">' + esc(JSON.stringify(adv, null, 2)) + '</textarea></details></div>';
    // preview and save
    h += '<div class="ae-sec"><h4>Preview</h4><div class="ae-prev">Tier <select class="tin" data-ae-p="t">' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (n === state.pt ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      ' PL <select class="tin" data-ae-p="pl">' + [1, 2, 3].map(function (n) { return '<option' + (n === state.ppl ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      ' <button type="button" class="lnk" data-ae="preview">Roll forces</button></div>' + (state.preview || '') + '</div>';
    h += '<div class="acct-editrow"><button type="button" class="lnk acct-danger" data-ae="reset"' + (state.changed[state.id] ? '' : ' disabled') + '>Reset to default</button>' +
      '<button type="button" class="lnk" data-ae="revert">Undo edits</button>' +
      '<button type="button" class="start" data-ae="save"' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? 'One moment…' : 'Save') + '</button></div>';
    return h + '</div>';
  }

  // the form read back into the personality
  function readForm() {
    var u = draft(), q = function (s) { return host.querySelector(s); };
    var val = function (k) { var e = q('[data-ae-f="' + k + '"]'); return e ? e.value : null; };
    u.name = (val('name') || '').trim() || u.name;
    var names = (val('names') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (names.length) u.names = names;
    u.force = u.force || {}; u.battle = u.battle || {}; u.doctrines = u.doctrines || {};
    u.force.tier = +val('tier') || 0;
    var hmin = val('hmin'), hmax = val('hmax');
    if (hmin !== '' || hmax !== '') {
      u.force.hulls = {};
      if (hmin !== '') u.force.hulls.min = +hmin;
      if (hmax !== '') u.force.hulls.max = +hmax;
    } else delete u.force.hulls;
    u.battle.temper = +val('temper') || 0;
    if (faction() === 'rebel') {
      var t = {};
      ['open', 'attack', 'defend'].forEach(function (role) {
        var on = Array.prototype.filter.call(host.querySelectorAll('[data-ae-tac="' + role + '"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
        if (on.length) t[role] = on.length === 1 ? on[0] : on;
      });
      if (Object.keys(t).length) u.battle.tactics = t; else delete u.battle.tactics;
    }
    var ids = function (s) { return (s || '').split(/[\s,]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); };
    var fx = ids(val('fixed')), sl = ids(val('shortlist'));
    if (fx.length) u.doctrines.fixed = fx; else delete u.doctrines.fixed;
    if (sl.length) u.doctrines.shortlist = sl;
    var advEl = host.querySelector('[data-ae-f="advanced"]');
    if (advEl) {
      var adv;
      try { adv = JSON.parse(advEl.value || '{}'); } catch (e) { throw new Error('The Advanced section is not valid JSON: ' + e.message); }
      if (adv.blurb != null) u.blurb = adv.blurb;
      ['force', 'battle', 'doctrines'].forEach(function (sec) {
        // what the form above does not show is replaced by what the Advanced section says
        Object.keys(u[sec] || {}).forEach(function (k) { if (SHOWN[sec].indexOf(k) < 0) delete u[sec][k]; });
        Object.keys((adv && adv[sec]) || {}).forEach(function (k) { if (SHOWN[sec].indexOf(k) < 0) u[sec][k] = adv[sec][k]; });
      });
      if (adv.campaign) u.campaign = adv.campaign; else delete u.campaign;
    }
    if (u.force.weights) {
      var w = {}, lims = {};
      Array.prototype.forEach.call(host.querySelectorAll('[data-ae-l]'), function (e) { lims[e.getAttribute('data-ae-l')] = e.value; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ae-w]'), function (e) {
        var k = e.getAttribute('data-ae-w'), v = joinParts(e.value, lims[k]);
        if (v != null) w[k] = v;
      });
      u.force.weights = w;
    }
    return u;
  }

  // forces rolled with the form's personality in force, not saved: a few to read, and the mix over many
  function preview() {
    var u = readForm(), ch = {}, all = clone(C().archetypeChanges());
    ch[state.id] = C().archetypeChange(state.id, u);
    Object.keys(all).forEach(function (k) { if (k !== state.id) ch[k] = all[k]; });
    var t = state.pt, pl = state.ppl, f = faction(), Rr = R();
    var out = C().withArchetypeChanges(ch, function () {
      var shown = [], n = 0, units = 0, hulls = 0, legal = 0, below = 0, own = 0, above = 0, groups = {};
      for (var i = 0; i < 100; i++) {
        var ks = Rr.rollArmy(t, pl, null, f, state.id); n++;
        if (Rr.checkArmy(ks, t, pl, null, null, f).ok) legal++;
        units += ks.length;
        var seen = {};
        ks.forEach(function (k) {
          var p = Rr.profile(Rr.splitPick(k).key);
          if (p.cls !== 'infantry') hulls++;
          if (!p.command) { if (p.tier < t) below++; else if (p.tier === t) own++; else above++; }
          seen[p.group] = 1;
        });
        Object.keys(seen).forEach(function (g) { groups[g] = (groups[g] || 0) + 1; });
        if (i < 4) {
          var c = {};
          ks.forEach(function (k) { var nm = Rr.profile(Rr.splitPick(k).key).name; c[nm] = (c[nm] || 0) + 1; });
          shown.push(Object.keys(c).map(function (nm) { return (c[nm] > 1 ? c[nm] + '× ' : '') + esc(nm); }).join(', '));
        }
      }
      var tt = below + own + above || 1;
      return '<p class="ae-stats">Over 100 forces: ' + (units / n).toFixed(1) + ' units, ' + (hulls / n).toFixed(1) + ' hulls; Tier below/own/above ' +
        [below, own, above].map(function (x) { return Math.round(100 * x / tt) + '%'; }).join(' / ') + (legal < n ? '; <b>' + (n - legal) + ' not legal</b>' : '') + '</p>' +
        '<p class="ae-stats">In forces: ' + Object.keys(groups).sort(function (a, b2) { return groups[b2] - groups[a]; }).map(function (g) { return esc(g) + ' ' + groups[g] + '%'; }).join(' · ') + '</p>' +
        '<ol class="ae-list">' + shown.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    });
    state.preview = out;
  }

  function refreshChanged(then) {
    api.get('api/archetypes').then(function (r) {
      if (r.ok && r.j) {
        state.changed = {};
        (r.j.updated || []).forEach(function (x) { state.changed[x.id] = x; });
        if (r.j.changes) C().applyArchetypeChanges(r.j.changes);
      }
      if (then) then();
    }, function () { if (then) then(); });
  }
  function draw() { if (host) host.innerHTML = html(); }

  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-ae]');
    if (!b) return;
    var a = b.getAttribute('data-ae');
    state.fault = ''; state.note = '';
    if (a === 'convert') { try { readForm(); } catch (e) { state.fault = e.message; draw(); return; } draft().force.weights = fromOlder(draft()); state.note = 'A starting list from its groups and mix: tune it, preview, then save.'; draw(); }
    else if (a === 'preview') { try { preview(); } catch (e) { state.fault = e.message; } draw(); }
    else if (a === 'revert') { state.draft = null; state.preview = null; draw(); }
    else if (a === 'save') {
      var u;
      try { u = readForm(); } catch (e) { state.fault = e.message; draw(); return; }
      state.busy = true; draw();
      api.post('api/admin/archetype-save', { id: state.id, data: u }).then(function (r) {
        state.busy = false;
        if (!r.ok) { state.fault = (r.j && r.j.error) || 'that did not work'; draw(); return; }
        state.note = 'Saved. New rolls use it now, here and on the server.';
        refreshChanged(function () { state.draft = null; draw(); });
      }, function () { state.busy = false; state.fault = 'The server could not be reached.'; draw(); });
    }
    else if (a === 'reset') {
      api.post('api/admin/archetype-reset', { id: state.id }).then(function (r) {
        if (!r.ok) { state.fault = (r.j && r.j.error) || 'that did not work'; draw(); return; }
        state.note = 'Back to its default.';
        refreshChanged(function () { state.draft = null; state.preview = null; draw(); });
      }, function () { state.fault = 'The server could not be reached.'; draw(); });
    }
  }
  function onChange(ev) {
    var t = ev.target;
    if (t.closest && t.closest('details[data-ae="adv"]')) state.advOpen = true;
    if (t.getAttribute('data-ae') === 'pick') { state.id = t.value; state.draft = null; state.preview = null; state.fault = ''; state.note = ''; draw(); }
    else if (t.getAttribute('data-ae-p') === 't') state.pt = +t.value;
    else if (t.getAttribute('data-ae-p') === 'pl') state.ppl = +t.value;
  }

  root.PMCArchEdit = {
    /* Into `el` (drawn afresh by the account screen): `io` is { get, post } for the
       server, as the account screen talks to it. */
    mount: function (el, io) {
      api = io;
      if (host !== el) {
        host = el;
        el.addEventListener('click', onClick);
        el.addEventListener('change', onChange);
        if (!state.loaded) { state.loaded = true; refreshChanged(draw); }
      }
      draw();
    },
    // for a test: the form read back, and the preview's text
    read: function () { return readForm(); },
    previewNow: function () { preview(); draw(); return state.preview; },
    pick: function (id) { state.id = id; state.draft = null; state.preview = null; draw(); }
  };
})(window);
