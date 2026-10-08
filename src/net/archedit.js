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

  // ---- reading and writing the draft by path ('campaign.found.t1') ----
  function getP(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function setP(o, path, v) {
    var ks = path.split('.'), last = ks.pop();
    ks.forEach(function (k) { if (o[k] == null || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; o = o[k]; });
    if (v === undefined) delete o[last]; else o[last] = v;
  }
  /* Lists of units, kept as rows of one or more units: the founding Tier I units and
     hulls (one each), the founding Tier II units (one, or two to pick between), the
     signature sets (several each), the favoured units of the older rules. */
  var ROWS = {
    'campaign.found.t1': 'one', 'campaign.found.hulls': 'one', 'force.units': 'one',
    'campaign.found.t2': 'pick', 'force.signature.units': 'set'
  };
  function rowsOf(path) {
    var v = getP(draft(), path) || [];
    if (ROWS[path] === 'set') return v.length && Array.isArray(v[0]) ? clone(v) : v.length ? [clone(v)] : [];
    return v.map(function (x) { return Array.isArray(x) ? clone(x) : [x]; });
  }
  function putRows(path, rows) {
    rows = rows.map(function (r) { return r.filter(Boolean); }).filter(function (r) { return r.length; });
    var kind = ROWS[path], v;
    if (!rows.length) v = Array.isArray(getP(draft(), path)) ? [] : undefined;   // (an empty list it had stays an empty list)
    else if (kind === 'one') v = rows.map(function (r) { return r[0]; });
    else if (kind === 'pick') v = rows.map(function (r) { return r.length === 1 ? r[0] : r; });
    else v = rows.length === 1 ? rows[0] : rows;          // one signature set is kept as a plain list
    setP(draft(), path, v);
  }
  function unitOpts(sel, test) {
    var groups = {};
    R().listFor(faction()).filter(test || function () { return true; }).forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
    return '<option value="">— choose —</option>' + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].sort(function (a, b2) { return a.tier - b2.tier; }).map(function (p) {
        return '<option value="' + p.key + '"' + (p.key === sel ? ' selected' : '') + '>' + esc(p.name) + ' (' + R().ROMAN[p.tier] + ')</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  function groupsOf(test) {
    var seen = [];
    R().listFor(faction()).forEach(function (p) { if ((!test || test(p)) && seen.indexOf(p.group) < 0) seen.push(p.group); });
    return seen;
  }
  function docOpts(sel) {
    return '<option value="">—</option>' + C().creedOf({ faction: faction() }).list.map(function (x) {
      return '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>' + x.id + ' ' + esc(x.name) + '</option>';
    }).join('');
  }
  // one control bound to a path: text, a number, a tick, or a choice
  function field(label, path, kind, extra) {
    var v = getP(draft(), path), at = ' data-ae-v="' + path + '" data-ae-k="' + kind + '"';
    if (kind === 'bool') return '<label class="ae-tick"><input type="checkbox"' + at + (v ? ' checked' : '') + '> ' + label + '</label>';
    if (kind === 'text') return '<label class="ae-wide">' + label + '<textarea class="tin" rows="2"' + at + '>' + esc(v || '') + '</textarea></label>';
    if (kind === 'sel') return '<label>' + label + '<select class="tin"' + at + '>' + extra.map(function (o) { return '<option value="' + o[0] + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    return '<label>' + label + '<input class="tin" type="number"' + (extra || '') + at + ' value="' + (v == null ? '' : v) + '"></label>';
  }
  // ticks for a list of groups bound to a path (favourite hulls, riders, the older rules' groups)
  function ticks(label, path, options) {
    var have = getP(draft(), path) || [];
    return '<div class="ae-ticks"><span>' + label + '</span>' + options.map(function (o) {
      var val = Array.isArray(o) ? o[0] : o, name = Array.isArray(o) ? o[1] : o;
      return '<label><input type="checkbox" data-ae-cb="' + path + '" value="' + esc(val) + '"' + (have.indexOf(val) >= 0 ? ' checked' : '') + '> ' + esc(name) + '</label>';
    }).join('') + '</div>';
  }
  // rows of units bound to a path; `more` names what a second unit in a row means ('or' / '+')
  function unitRows(label, path, test, more) {
    var rows = rowsOf(path), sel = function (k, i, m) { return '<select class="tin" data-ae-row="' + path + '" data-r="' + i + '" data-m="' + m + '">' + unitOpts(k, test) + '</select>'; };
    var del = function (i, m) { return '<button type="button" class="lnk" data-ae="delm" data-path="' + path + '" data-r="' + i + '" data-m="' + m + '" title="Take this one out">×</button>'; };
    var drop = function (i, what) { return '<button type="button" class="lnk acct-danger" data-ae="del" data-path="' + path + '" data-r="' + i + '">' + what + '</button>'; };
    return '<div class="ae-rows"><span>' + label + '</span>' + rows.map(function (r, i) {
      // a signature set: a box of its own, a unit a line
      if (more === 'set') {
        return '<div class="ae-set"><small class="ae-dim">Set ' + (i + 1) + '</small>' + r.map(function (k, m) {
          return '<div class="ae-row">' + sel(k, i, m) + (r.length > 1 ? del(i, m) : '') + '</div>';
        }).join('') + '<div class="ae-row"><button type="button" class="lnk" data-ae="addm" data-path="' + path + '" data-r="' + i + '">+ unit</button>' + drop(i, 'Remove set') + '</div></div>';
      }
      return '<div class="ae-row">' + r.map(function (k, m) { return (m ? '<em>or</em>' : '') + sel(k, i, m) + (m ? del(i, m) : ''); }).join('') +
        (more === 'or' && r.length < 2 ? '<button type="button" class="lnk" data-ae="addm" data-path="' + path + '" data-r="' + i + '">+ or</button>' : '') + drop(i, 'Remove') + '</div>';
    }).join('') + '<button type="button" class="lnk" data-ae="add" data-path="' + path + '">' + (more === 'set' ? '+ Add a set' : '+ Add') + '</button></div>';
  }
  /* rows of { key: number } bound to a path (the Tier I refill, the older rules' mix and
     limits); `keys` the choices for a key */
  function mapRows(label, path, keys, hint) {
    var m = getP(draft(), path) || {};
    return '<div class="ae-rows"><span>' + label + (hint ? ' <small class="ae-dim">' + hint + '</small>' : '') + '</span>' + Object.keys(m).map(function (k) {
      return '<div class="ae-row"><select class="tin" data-ae-mapk="' + path + '" data-k="' + esc(k) + '">' + keys.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === k ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
        '<input class="tin ae-n" type="number" min="0" max="20" step="0.5" data-ae-mapv="' + path + '" data-k="' + esc(k) + '" value="' + m[k] + '">' +
        '<button type="button" class="lnk acct-danger" data-ae="delk" data-path="' + path + '" data-k="' + esc(k) + '">Remove</button></div>';
    }).join('') + '<button type="button" class="lnk" data-ae="addk" data-path="' + path + '">+ Add</button></div>';
  }
  function unitKeys() { return R().listFor(faction()).map(function (p) { return [p.key, p.name + ' (' + R().ROMAN[p.tier] + ')']; }); }
  function groupKeys() { return groupsOf().map(function (g) { return [g, g]; }); }

  // the sections beyond the weighted list: everything else a personality has
  function moreHTML(u) {
    var f = u.force || {}, d = u.doctrines || {};
    var hullGroups = groupsOf(function (p) { return p.cls !== 'infantry'; });
    var h = '';
    // its hulls and riders
    h += '<div class="ae-sec"><h4>Hulls and riders</h4>' +
      ticks('Favourite hulls (taken first)', 'force.favourites', hullGroups.concat([['transports', 'anything that carries troops']])) +
      '<div class="ae-grid">' + field('Hulls kept in a campaign (blank: twice the skirmish most)', 'force.machinesMax', 'num', ' min="0" max="9"') +
      field('A machine company (any hull of its own counts as a favourite)', 'force.machineMinded', 'bool') + '</div>' +
      (groupsOf(function (p) { return p.cls === 'infantry' && p.ridersUpgrade; }).length ? ticks('Groups that ride (recruited mounted where they may)', 'force.riders', groupsOf(function (p) { return p.cls === 'infantry' && p.ridersUpgrade; })) : '') + '</div>';
    // signature units
    h += '<div class="ae-sec"><h4>Signature units</h4><small class="ae-dim">What it is known for: kept up from each set (one a Priority Level in a skirmish roll; one a Company Tier in a campaign, up to the most).</small>' +
      unitRows('Sets', 'force.signature.units', null, 'set') +
      '<div class="ae-grid">' + field('Most kept from a set (campaign)', 'force.signature.max', 'num', ' min="0" max="9"') +
      field('Or as many as this, whatever the Tier', 'force.signature.cap', 'num', ' min="0" max="20"') + '</div></div>';
    // doctrines beyond the fixed and the shortlist
    var fa = d.fixedAt || {};
    h += '<div class="ae-sec"><h4>Doctrine stages and set Tiers</h4>' +
      '<div class="ae-rows"><span>Stages (in turn, each shuffled; used in place of the shortlist)</span>' + (d.stages || []).map(function (st, i) {
        return '<div class="ae-row"><input class="tin" data-ae-stage="' + i + '" value="' + esc(st.join(', ')) + '" placeholder="e.g. V6, V5, V1">' +
          '<button type="button" class="lnk acct-danger" data-ae="delstage" data-r="' + i + '">Remove</button></div>';
      }).join('') + '<button type="button" class="lnk" data-ae="addstage">+ Add a stage</button></div>' +
      '<div class="ae-rows"><span>Fixed at a Tier (that doctrine goes in at that place in the order)</span>' + Object.keys(fa).sort().map(function (t) {
        return '<div class="ae-row">Tier <select class="tin ae-n" data-ae-fat="' + t + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(n) === t ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
          '<select class="tin" data-ae-fad="' + t + '">' + docOpts(fa[t]) + '</select>' +
          '<button type="button" class="lnk acct-danger" data-ae="delfat" data-k="' + t + '">Remove</button></div>';
      }).join('') + '<button type="button" class="lnk" data-ae="addfat">+ Add</button></div>' +
      field('No creed to speak of: draws from the whole list at random', 'doctrines.random', 'bool') + '</div>';
    // the campaign rival's own
    h += '<div class="ae-sec"><h4>Campaign</h4>' +
      unitRows('Founded with, Tier I', 'campaign.found.t1', function (p) { return p.cls === 'infantry' && !p.command; }) +
      unitRows('Founded with, Tier II (two in a row: one of them, at random)', 'campaign.found.t2', function (p) { return p.cls === 'infantry' && !p.command; }, 'or') +
      unitRows('Founding hulls', 'campaign.found.hulls', function (p) { return p.cls !== 'infantry'; }) +
      '<div class="ae-grid">' + field('How many founding hulls it takes', 'campaign.found.hullCount', 'num', ' min="0" max="6"') +
      field('Its free founders are founded with too (not left to take on later)', 'campaign.found.free', 'bool') + '</div>' +
      mapRows('Tier I gaps filled with', 'campaign.refill', unitKeys().filter(function (o) { return R().profile(o[0]).tier === 1; }), 'as often as its weight') +
      '<div class="ae-grid">' + field('Spends its money and experience on', 'campaign.spend', 'sel', [['promote', 'promoting its units'], ['honours', 'honours before promotion'], ['recruit', 'recruiting widely'], ['machines', 'hulls']]) +
      field('Lean: keeps to the size it means to be', 'campaign.lean', 'bool') +
      field('Lean size (units)', 'campaign.leanSize', 'num', ' min="6" max="60" placeholder="24"') +
      field('Honours before its first promotion, once it has Rapid Training Methods', 'campaign.honourFirst', 'bool') + '</div></div>';
    // the older rules, for a personality with no weighted list yet
    if (!f.weights) {
      h += '<div class="ae-sec"><h4>Older rules (until it has a weighted list)</h4>' +
        ticks('Its own groups', 'force.groups', groupsOf()) +
        ticks('Second choices', 'force.second', groupsOf()) +
        unitRows('Favoured units from other groups', 'force.units') +
        mapRows('Mix (its groups’ shares)', 'force.mix', groupKeys()) +
        mapRows('Limits (most on its books; 0 none)', 'force.limit', groupKeys().concat(unitKeys())) + '</div>';
    }
    return h;
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
      field('Blurb (what it is, in a line)', 'blurb', 'text') +
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
      '<label class="ae-wide">Shortlist (taken next, in a random order)<input class="tin" data-ae-f="shortlist" value="' + esc((d.shortlist || []).join(', ')) + '"></label></div>' +
      '<small class="ae-dim">One a Company Tier: the fixed ones first, then the shortlist shuffled, then the rest shuffled.' +
      (d.stages ? ' <b>This one takes its shortlist in stages (Advanced: doctrines.stages), each shuffled and in turn — the shortlist above is not used.</b>' : '') +
      (d.fixedAt ? ' One is fixed at a Tier of its own (Advanced: doctrines.fixedAt).' : '') + '</small><br>' +
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
    h += moreHTML(u);
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
    // (0 is what an unset one means: one not set stays unset)
    var tier0 = +val('tier') || 0;
    if (tier0 || u.force.tier != null) u.force.tier = tier0;
    var hmin = val('hmin'), hmax = val('hmax');
    if (hmin !== '' || hmax !== '') {
      u.force.hulls = {};
      if (hmin !== '') u.force.hulls.min = +hmin;
      if (hmax !== '') u.force.hulls.max = +hmax;
    } else delete u.force.hulls;
    var temper0 = +val('temper') || 0;
    if (temper0 || u.battle.temper != null) u.battle.temper = temper0;
    if (faction() === 'rebel') {
      var t = {};
      ['open', 'attack', 'defend'].forEach(function (role) {
        var on = Array.prototype.filter.call(host.querySelectorAll('[data-ae-tac="' + role + '"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
        // (a coin toss has no order: the same two ticked keep the order they had)
        var had = [].concat((u.battle.tactics || {})[role] || []);
        if (on.length > 1 && had.length === on.length && had.every(function (x) { return on.indexOf(x) >= 0; })) on = had;
        if (on.length) t[role] = on.length === 1 ? on[0] : on;
      });
      if (Object.keys(t).length) u.battle.tactics = t; else delete u.battle.tactics;
    }
    var ids = function (s) { return (s || '').split(/[\s,]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); };
    var fx = ids(val('fixed')), sl = ids(val('shortlist'));
    if (fx.length) u.doctrines.fixed = fx; else delete u.doctrines.fixed;
    if (sl.length) u.doctrines.shortlist = sl;
    if (u.force.weights) {
      var w = {}, lims = {};
      Array.prototype.forEach.call(host.querySelectorAll('[data-ae-l]'), function (e) { lims[e.getAttribute('data-ae-l')] = e.value; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ae-w]'), function (e) {
        var k = e.getAttribute('data-ae-w'), v = joinParts(e.value, lims[k]);
        if (v != null) w[k] = v;
      });
      u.force.weights = w;
    }
    // rows left empty, and empty stages, are dropped before it goes anywhere
    Object.keys(ROWS).forEach(function (path) { if (getP(u, path) !== undefined) putRows(path, rowsOf(path)); });
    if (u.doctrines.stages) { u.doctrines.stages = u.doctrines.stages.filter(function (st) { return st && st.length; }); if (!u.doctrines.stages.length) delete u.doctrines.stages; }
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
    if (['add', 'del', 'addm', 'delm', 'addk', 'delk', 'addstage', 'delstage', 'addfat', 'delfat'].indexOf(a) >= 0) { rowAction(a, b); return; }
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
  // a change to one of the bound controls goes straight into the draft
  function bound(t) {
    var u = draft(), path = t.getAttribute('data-ae-v');
    if (path) {
      var kind = t.getAttribute('data-ae-k'), v;
      if (kind === 'bool') v = t.checked ? true : undefined;
      else if (kind === 'num') v = t.value === '' || isNaN(+t.value) ? undefined : +t.value;
      else v = t.value.trim() === '' ? undefined : t.value;
      setP(u, path, v);
      return true;
    }
    var cb = t.getAttribute('data-ae-cb');
    if (cb) {
      var on = Array.prototype.filter.call(host.querySelectorAll('[data-ae-cb="' + cb + '"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
      setP(u, cb, on.length ? on : undefined);
      return true;
    }
    var rp = t.getAttribute('data-ae-row');
    if (rp) {
      var rows = rowsOf(rp), r = +t.getAttribute('data-r'), m = +t.getAttribute('data-m');
      if (rows[r]) { rows[r][m] = t.value; putRows(rp, rows); }
      return true;
    }
    var mk = t.getAttribute('data-ae-mapk'), mv = t.getAttribute('data-ae-mapv');
    if (mk || mv) {
      var mp = mk || mv, old = t.getAttribute('data-k'), map = clone(getP(u, mp) || {}), out = {};
      Object.keys(map).forEach(function (k) {
        if (k !== old) { out[k] = map[k]; return; }
        if (mk) out[t.value] = map[k]; else out[k] = t.value === '' ? 0 : +t.value;
      });
      setP(u, mp, Object.keys(out).length ? out : undefined);
      if (mk) draw();                      // the row's key changed: its controls are named by it
      return true;
    }
    if (t.hasAttribute('data-ae-stage')) {
      u.doctrines = u.doctrines || {};
      var st = clone(u.doctrines.stages || []), i = +t.getAttribute('data-ae-stage');
      st[i] = t.value.split(/[\s,]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      u.doctrines.stages = st;
      return true;
    }
    var fat = t.getAttribute('data-ae-fat'), fad = t.getAttribute('data-ae-fad');
    if (fat || fad) {
      u.doctrines = u.doctrines || {};
      var fa = clone(u.doctrines.fixedAt || {});
      if (fad) { if (t.value) fa[fad] = t.value; else delete fa[fad]; }
      else { var dd = fa[fat]; delete fa[fat]; fa[t.value] = dd; }
      u.doctrines.fixedAt = Object.keys(fa).length ? fa : undefined;
      if (!u.doctrines.fixedAt) delete u.doctrines.fixedAt;
      if (fat) draw();
      return true;
    }
    return false;
  }
  // a row added or taken out: what is typed above is kept first, then the draft changed and drawn again
  function rowAction(a, b) {
    readForm();
    var u = draft(), path = b.getAttribute('data-path'), r = +b.getAttribute('data-r'), m = +b.getAttribute('data-m'), k = b.getAttribute('data-k');
    if (a === 'add') { var rows = rowsOf(path); rows.push(['']); putRowsKeep(path, rows); }
    else if (a === 'del') { var rd = rowsOf(path); rd.splice(r, 1); putRows(path, rd); }
    else if (a === 'addm') { var ra = rowsOf(path); if (ra[r]) ra[r].push(''); putRowsKeep(path, ra); }
    else if (a === 'delm') { var rm = rowsOf(path); if (rm[r]) rm[r].splice(m, 1); putRows(path, rm); }
    else if (a === 'addk') {
      var map = clone(getP(u, path) || {});
      var choices = path === 'campaign.refill' ? unitKeys().filter(function (o) { return R().profile(o[0]).tier === 1; }) : path === 'force.mix' ? groupKeys() : groupKeys().concat(unitKeys());
      var free = choices.filter(function (o) { return !(o[0] in map); })[0];
      if (free) { map[free[0]] = 1; setP(u, path, map); }
    }
    else if (a === 'delk') { var mp = clone(getP(u, path) || {}); delete mp[k]; setP(u, path, Object.keys(mp).length ? mp : undefined); }
    else if (a === 'addstage') { u.doctrines = u.doctrines || {}; u.doctrines.stages = (u.doctrines.stages || []).concat([[]]); }
    else if (a === 'delstage') { var st = (u.doctrines.stages || []).slice(); st.splice(r, 1); if (st.length) u.doctrines.stages = st; else delete u.doctrines.stages; }
    else if (a === 'addfat') {
      u.doctrines = u.doctrines || {};
      var fa = clone(u.doctrines.fixedAt || {}), t = [2, 3, 4, 5, 1].filter(function (n) { return !(n in fa); })[0];
      if (t) { fa[t] = C().creedOf({ faction: faction() }).list[0].id; u.doctrines.fixedAt = fa; }
    }
    else if (a === 'delfat') { var fd = clone(u.doctrines.fixedAt || {}); delete fd[k]; if (Object.keys(fd).length) u.doctrines.fixedAt = fd; else delete u.doctrines.fixedAt; }
    draw();
  }
  // (a new, still empty row is kept in the draft until a unit is chosen in it)
  function putRowsKeep(path, rows) {
    var kind = ROWS[path];
    setP(draft(), path, kind === 'set' ? rows : rows.map(function (r) { return kind === 'one' ? r[0] : r.length === 1 ? r[0] : r; }));
  }
  function onChange(ev) {
    var t = ev.target;
    if (bound(t)) return;
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
