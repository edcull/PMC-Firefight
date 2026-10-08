/* PMC 2670 — Firefight : the admin's personality editor (server tools).

   One personality at a time, read as one object (campaign.js unifiedArchetype):
   its names, how elite it is, its hulls, its temper and tactics, its doctrines,
   and its weighted list of units — a weight and a limit a Priority Level for each
   group, and for any unit in it that differs. Preview rolls forces with the
   changes in force, as they stand in the form, without saving; Save sends the
   whole personality to the server (server/archetypes.js), which keeps its
   difference from the default; Reset puts the default back.

   Opened by account.js from the server tools, in a window of its own over the
   account screen; it keeps its own state between draws and between openings. */
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

  // ---- reading and writing the draft by path ('campaign.found.t1') ----
  function getP(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function setP(o, path, v) {
    var ks = path.split('.'), last = ks.pop();
    ks.forEach(function (k) { if (o[k] == null || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; o = o[k]; });
    if (v === undefined) delete o[last]; else o[last] = v;
  }
  /* Lists of units, kept as rows of one or more units: the founding Tier I units and
     hulls (one each), the founding Tier II units (one, or two to pick between). */
  var ROWS = {
    'campaign.found.t1': 'one', 'campaign.found.hulls': 'one',
    'campaign.found.t2': 'pick'
  };
  function rowsOf(path) {
    var v = getP(draft(), path) || [];
    return v.map(function (x) { return Array.isArray(x) ? clone(x) : [x]; });
  }
  function putRows(path, rows) {
    rows = rows.map(function (r) { return r.filter(Boolean); }).filter(function (r) { return r.length; });
    var kind = ROWS[path], v;
    if (!rows.length) v = Array.isArray(getP(draft(), path)) ? [] : undefined;   // (an empty list it had stays an empty list)
    else if (kind === 'one') v = rows.map(function (r) { return r[0]; });
    else v = rows.map(function (r) { return r.length === 1 ? r[0] : r; });
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
  // what a setting does, in a line under it
  function tip(t) { return t ? '<small class="ae-help">' + t + '</small>' : ''; }
  // one control bound to a path: text, a number, a tick, or a choice (`help`: what it does)
  function field(label, path, kind, extra, help) {
    var v = getP(draft(), path), at = ' data-ae-v="' + path + '" data-ae-k="' + kind + '"';
    if (kind === 'bool') return '<label class="ae-tick"><input type="checkbox"' + at + (v ? ' checked' : '') + '><span>' + label + tip(help) + '</span></label>';
    if (kind === 'text') return '<label class="ae-wide">' + label + '<textarea class="tin" rows="' + (extra || 2) + '"' + at + '>' + esc(v || '') + '</textarea>' + tip(help) + '</label>';
    if (kind === 'sel') return '<label>' + label + '<select class="tin"' + at + '>' + extra.map(function (o) { return '<option value="' + o[0] + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' + tip(help) + '</label>';
    return '<label>' + label + '<input class="tin" type="number"' + (extra || '') + at + ' value="' + (v == null ? '' : v) + '">' + tip(help) + '</label>';
  }
  // ticks for a list of groups bound to a path (the groups that ride)
  function ticks(label, path, options, help) {
    var have = getP(draft(), path) || [];
    return '<div class="ae-ticks"><span>' + label + tip(help) + '</span>' + options.map(function (o) {
      var val = Array.isArray(o) ? o[0] : o, name = Array.isArray(o) ? o[1] : o;
      return '<label><input type="checkbox" data-ae-cb="' + path + '" value="' + esc(val) + '"' + (have.indexOf(val) >= 0 ? ' checked' : '') + '> ' + esc(name) + '</label>';
    }).join('') + '</div>';
  }
  // rows of units bound to a path; `more` names what a second unit in a row means ('or' / '+')
  function unitRows(label, path, test, more, help) {
    var rows = rowsOf(path), sel = function (k, i, m) { return '<select class="tin" data-ae-row="' + path + '" data-r="' + i + '" data-m="' + m + '">' + unitOpts(k, test) + '</select>'; };
    var del = function (i, m) { return '<button type="button" class="lnk" data-ae="delm" data-path="' + path + '" data-r="' + i + '" data-m="' + m + '" title="Take this one out">×</button>'; };
    var drop = function (i, what) { return '<button type="button" class="lnk acct-danger" data-ae="del" data-path="' + path + '" data-r="' + i + '">' + what + '</button>'; };
    return '<div class="ae-rows"><span>' + label + tip(help) + '</span>' + rows.map(function (r, i) {
      return '<div class="ae-row">' + r.map(function (k, m) { return (m ? '<em>or</em>' : '') + sel(k, i, m) + (m ? del(i, m) : ''); }).join('') +
        (more === 'or' && r.length < 2 ? '<button type="button" class="lnk" data-ae="addm" data-path="' + path + '" data-r="' + i + '">+ or</button>' : '') + drop(i, 'Remove') + '</div>';
    }).join('') + '<div class="ae-row"><button type="button" class="lnk" data-ae="add" data-path="' + path + '">' + '+ Add' + '</button></div></div>';
  }

  // the sections beyond the weighted list: everything else a personality has
  function moreHTML(u) {
    var f = u.force || {}, d = u.doctrines || {};
    var hullGroups = groupsOf(function (p) { return p.cls !== 'infantry'; });
    var S = {};
    // its vehicles: how many, and who rides
    S.hulls = sec('hulls', 'Vehicle composition') + '<div class="ae-grid">' +
      // (one control for both ends: vehicles a Priority Level, at least and at most)
      '<div class="ae-pair"><span>Vehicles a Priority Level (min / max)</span><div class="ae-pairin">' +
        '<input class="tin" type="number" min="0" max="3" step="0.5" data-ae-f="hmin" aria-label="Vehicles a Priority Level, min" value="' + (f.hulls && f.hulls.min != null ? f.hulls.min : '') + '" placeholder="1"><em>to</em>' +
        '<input class="tin" type="number" min="0" max="3" step="0.5" data-ae-f="hmax" aria-label="Vehicles a Priority Level, max" value="' + (f.hulls && f.hulls.max != null ? f.hulls.max : '') + '" placeholder="1.5"></div>' +
        tip('Per Priority Level, rounded (1.5 = 2 at PL1, 3 at PL2, 5 at PL3). Never more than 3. The min are rolled first, by the weights.') + '</div></div>' +
      (groupsOf(function (p) { return p.cls === 'infantry' && p.ridersUpgrade; }).length ? ticks('Groups that ride', 'force.riders', groupsOf(function (p) { return p.cls === 'infantry' && p.ridersUpgrade; }),
        'In a campaign, units of these groups (and its leader, if of one) are recruited mounted wherever the rules let them ride.') : '') + '</div>';
    // doctrines taken in stages, in place of the shortlist
    S.stages = sec('stages', 'Doctrine stages', 'Stages') +
      '<div class="ae-rows"><span>Stages' + tip('In place of the shortlist: it takes all of stage 1 in a random order, then all of stage 2, and so on, then the rest at random. Doctrine codes separated by commas; the codes are listed under Doctrines above.') + '</span>' + (d.stages || []).map(function (st, i) {
        return '<div class="ae-row"><input class="tin" data-ae-stage="' + i + '" value="' + esc(st.join(', ')) + '" placeholder="e.g. V6, V5, V1">' +
          '<button type="button" class="lnk acct-danger" data-ae="delstage" data-r="' + i + '">Remove</button></div>';
      }).join('') + '<button type="button" class="lnk" data-ae="addstage">+ Add a stage</button></div>' +
      field('No creed to speak of', 'doctrines.random', 'bool', null, 'Ignores the fixed Tiers, the shortlist and the stages: every doctrine is drawn from the whole list at random.') + '</div>';
    // the campaign rival's own
    S.camp = sec('camp', 'Campaign') +
      '<small class="ae-dim">How an AI rival company starts, grows and fields its forces in a campaign.</small>' +
      unitRows('Founded with, Tier I', 'campaign.found.t1', function (p) { return p.cls === 'infantry' && !p.command; }, null,
        'The Tier I units it is founded with, one each (a unit twice: two). Later Tier I gaps are filled by its weights.') +
      unitRows('Founded with, Tier II', 'campaign.found.t2', function (p) { return p.cls === 'infantry' && !p.command; }, 'or',
        'The Tier II units it is founded with. Two in a row: one or the other, at random each campaign. It fills Tier II gaps from these.') +
      unitRows('Founding hulls', 'campaign.found.hulls', function (p) { return p.cls !== 'infantry'; }, null,
        'The hulls it may be founded with; it takes as many as the next number, chosen from these.') +
      '<div class="ae-grid">' + field('How many founding hulls it takes', 'campaign.found.hullCount', 'num', ' min="0" max="6"') +
      field('Founded with its free units', 'campaign.found.free', 'bool', null,
        'Units that cost nothing to recruit (Armed civilians) are normally left out of the founding list and come in later to fill gaps. Ticked: it is founded with them (a revolt that starts as civilians).') + '</div>' +
      '<div class="ae-grid">' + field('Hulls kept', 'force.machinesMax', 'num', ' min="0" max="9"',
        'How many hulls it buys and keeps, trading the smallest for a bigger one as it grows. Blank: twice the vehicle max.') +
      field('Fields its hulls first', 'force.machineMinded', 'bool', null,
        'In battle it puts its hulls in the field before its infantry, and spends spare points on hulls rather than men.') +
      field('Spends its money and experience on', 'campaign.spend', 'sel', [['promote', 'promoting its units'], ['honours', 'honours before promotion'], ['recruit', 'recruiting widely'], ['machines', 'hulls']],
        'Promoting: experience goes on promotions, money on growing a Tier at a time (the usual). Honours: a unit is trained to its full honours before it is promoted (veterans, not rank). Recruiting: it also hires up to three more units a turn at its own Tier and the next while it is not saving for a Company Tier. Hulls: it buys a hull whenever it can and fits armour and guns first.') +
      field('Lean', 'campaign.lean', 'bool', null,
        'Keeps to the size below: it does not hire with spare money, does not top up with free units, and at full size will not promote a unit out of a Tier that would leave it under three. Not ticked: it keeps hiring up to 12 + 7 a Company Tier units.') +
      field('Lean size (units)', 'campaign.leanSize', 'num', ' min="6" max="60" placeholder="24"', 'Only for a lean company. Blank: 24.') +
      field('Honours before its first promotion', 'campaign.honourFirst', 'bool', null,
        'Once it holds Rapid Training Methods (S6), each unit takes one honour before its first promotion.') + '</div></div>';
    return S;
  }
  // a section of the form: a card with its heading, named in the side list
  function sec(id, title, nav) { return '<div class="ae-sec" id="ae-s-' + id + '" data-nav="' + esc(nav || title) + '"><h4>' + title + '</h4>'; }
  function html() {
    var u = draft(), f = u.force || {}, b = u.battle || {}, d = u.doctrines || {}, list = R().listFor(faction());
    // the window's head: which one, and whether an admin has changed it
    var head = '<div class="ae-title"><small>Personality</small><select class="tin" data-ae="pick" aria-label="Personality">' + FACTIONS.map(function (fa) {
      return '<optgroup label="' + fa[1] + '">' + C().archetypesFor(fa[0]).filter(function (a) { return (a.faction || 'pmc') === fa[0]; }).map(function (a) {
        return '<option value="' + a.id + '"' + (a.id === state.id ? ' selected' : '') + '>' + esc(a.name) + (state.changed[a.id] ? ' •' : '') + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '</select></div>' +
      '<span class="ae-chip">' + (FACTIONS.filter(function (fa) { return fa[0] === faction(); })[0] || ['', ''])[1] + '</span>' +
      (state.changed[state.id] ? '<small class="ae-tag">changed by ' + esc(state.changed[state.id].by || 'an admin') + '</small>' : '<small class="ae-tag ae-dim">default</small>') +
      '<button type="button" class="ae-x" data-ae="close" aria-label="Close" title="Close">×</button>';
    var h = '';
    // who it is
    h += sec('who', 'Who it is') + '<div class="ae-grid">' +
      '<label>Name<input class="tin" data-ae-f="name" value="' + esc(u.name || '') + '" maxlength="60"></label>' +
      '<label class="ae-wide">Company names (one per line)<textarea class="tin" data-ae-f="names" rows="3">' + esc((u.names || []).join('\n')) + '</textarea></label>' +
      field('Description', 'blurb', 'text') +
      field('Validation notes', 'notes', 'text', 5, 'Free text, for people only: what a build of it should look like, to check the preview’s forces against. The game does not use it.') + '</div></div>';
    // the shape of its forces
    h += sec('shape', 'Force shape') + '<div class="ae-grid">' +
      '<label>Tier preference<select class="tin" data-ae-f="tier">' + [[-1, '−1 fills up a Tier below'], [0, '0 its own Tier'], [1, '+1 reaches a Tier above']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((f.tier || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        tip('How elite the force is. −1 to prefer Tiers below, +1 to prefer Tiers above the battle Tier.') + '</label>' +
      '<label>Temper (behaviour roll)<select class="tin" data-ae-f="temper">' + [-3, -2, -1, 0, 1, 2, 3].map(function (n) {
        return '<option value="' + n + '"' + ((b.temper || 0) === n ? ' selected' : '') + '>' + (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + '</option>'; }).join('') + '</select>' +
        tip('Added to its units’ behaviour roll in battle (p. 147). +: presses in and charges. −: holds back and shoots from cover.') + '</label>' +
      // (a swarm has one Leader Bug, as the rules have it: nothing to choose)
      (faction() === 'bugs' ? '' : field('Command units a Priority Level', 'force.command', 'num', ' min="0" max="1" step="0.25" placeholder="one a force"',
        'On average, in a skirmish roll: 0 none, 0.5 one for every two Priority Levels, 1 one each (the most the rules allow). Blank: one, whatever the Priority Level.')) +
      field('Command level', 'force.commandTier', 'sel', faction() === 'bugs' ? [['', '0 the battle’s Tier'], ['1', '+1 a Tier above']] : [['-1', '−1 a Tier below'], ['', '0 the battle’s Tier'], ['1', '+1 a Tier above']],
        faction() === 'bugs' ? 'The Tier of its Leader Bug: the battle’s, or one above (never below, as the rules have it).' : 'The Tier of its highest command unit, against the battle’s; each one after it is a Tier below that.') +
      '</div>';
    var more = moreHTML(u), battle = '';
    // tactics: a Rebel's
    if (faction() === 'rebel') {
      var t = b.tactics || {};
      battle += '<div class="ae-sub"><h5>Rebel Tactics</h5><small class="ae-dim">The Rebel tactic it chooses in battle, by the role it has. Human Wave: two extra infantry units a Priority Level, and faster infantry. Last Stand: +4 Defence in cover, barricades, and morale holds longer. Guerillas: its infantry gain Stealth and Battlefield Insertion.</small>' + ['open', 'attack', 'defend'].map(function (role) {
        var have = [].concat(t[role] || []);
        return '<div class="ae-tac"><span>' + ({ open: 'In the open', attack: 'Attacking', defend: 'Defending' })[role] + '</span>' + TACTICS.map(function (x) {
          return '<label><input type="checkbox" data-ae-tac="' + role + '" value="' + x[0] + '"' + (have.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>';
        }).join('') + '</div>';
      }).join('') + '<small class="ae-dim">Two ticked: a coin toss between them. None: the usual (Human Wave, and Last Stand on defence).</small></div>';
    }
    // (in the force's shape, under its temper)
    h += battle + '</div>';
    // doctrines
    var creed = C().creedOf({ faction: faction() }).list, docs = '', fa = d.fixedAt || {};
    docs += sec('docs', 'Doctrines') + '<div class="ae-grid">' +
      '<label class="ae-wide">Shortlist (taken next, in a random order)<input class="tin" data-ae-f="shortlist" value="' + esc((d.shortlist || []).join(', ')) + '">' + tip('Shuffled anew for each company, so two companies of it differ.') + '</label></div>' +
      '<div class="ae-rows"><span>Fixed at a Tier' + tip('The doctrine it takes on reaching that Company Tier (Tier I: what it is known for, from the start); the rest move along one.') + '</span>' + Object.keys(fa).sort().map(function (t) {
        return '<div class="ae-row">Tier <select class="tin ae-n" data-ae-fat="' + t + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(n) === t ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
          '<select class="tin" data-ae-fad="' + t + '">' + docOpts(fa[t]) + '</select>' +
          '<button type="button" class="lnk acct-danger" data-ae="delfat" data-k="' + t + '">Remove</button></div>';
      }).join('') + '<button type="button" class="lnk" data-ae="addfat">+ Add</button></div>' +
      '<small class="ae-dim">A campaign company takes one doctrine a Company Tier: the one fixed at that Tier, otherwise the next of the shortlist (shuffled), then the rest shuffled. Codes separated by commas.' +
      (d.stages ? ' <b>This one takes its shortlist in stages (Doctrine stages, below): the shortlist here is not used.</b>' : '') + '</small>' +
      '<details class="ae-codes"><summary class="ae-dim">The doctrine codes</summary><ul>' + creed.map(function (x) { return '<li><b>' + x.id + '</b> ' + esc(x.name) + '</li>'; }).join('') + '</ul></details></div>';
    // the weighted list
    var w = f.weights || null;
    h += sec('weights', 'Weighted list');
    w = w || {};
    {
      var groups = {};
      // (its command units are not weighted: the command settings above choose them)
      list.forEach(function (p) { if (!(p.command || p.alpha || p.leaderBug)) (groups[p.group] = groups[p.group] || []).push(p); });
      h += '<table class="ae-w"><tr><th></th><th>Weight</th><th>Limit</th></tr>' + Object.keys(groups).map(function (g) {
        var gp = parts(w[g]);
        var row = '<tr class="ae-g"><td>' + esc(g) + '</td><td><input class="tin" type="number" min="0" max="100" data-ae-w="' + esc(g) + '" value="' + gp.w + '"></td><td><input class="tin" type="number" min="0" max="9" data-ae-l="' + esc(g) + '" value="' + gp.l + '"></td></tr>';
        return row + groups[g].sort(function (a, b2) { return a.tier - b2.tier; }).map(function (p) {
          var pp = parts(w[p.key]);
          return '<tr class="ae-u"><td>' + esc(p.name) + ' <small>' + R().ROMAN[p.tier] + (p.cls !== 'infantry' ? ' · ' + p.cls : '') + '</small></td><td><input class="tin" type="number" min="0" max="100" data-ae-w="' + p.key + '" value="' + pp.w + '" placeholder="' + gp.w + '"></td><td><input class="tin" type="number" min="0" max="9" data-ae-l="' + p.key + '" value="' + pp.l + '" placeholder="' + gp.l + '"></td></tr>';
        }).join('');
      }).join('') + '</table>';
    }
    h += '</div>';
    // in the order an admin thinks of it: what it fields, then how it fights, then its campaign
    h += more.hulls + docs + more.stages + more.camp;
    // preview
    h += sec('preview', 'Preview') + '<small class="ae-dim">Rolls forces with the edits in force, as they stand in the form, without saving them.</small>' +
      // (its validation notes beside the forces, to read them against)
      (u.notes ? '<p class="ae-notes"><b>Validation notes</b>' + esc(u.notes) + '</p>' : '') +
      '<div class="ae-prev"><label>Tier <select class="tin" data-ae-p="t">' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (n === state.pt ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>PL <select class="tin" data-ae-p="pl">' + [1, 2, 3].map(function (n) { return '<option' + (n === state.ppl ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="lnk" data-ae="preview">Roll forces</button></div>' + (state.preview || '') + '</div>';
    // the foot: what happened, and the buttons
    var foot = (state.fault ? '<p class="faults">' + esc(state.fault) + '</p>' : '') + (state.note ? '<p class="acct-notice">' + esc(state.note) + '</p>' : '') +
      '<div class="ae-btns"><button type="button" class="lnk acct-danger" data-ae="reset"' + (state.changed[state.id] ? '' : ' disabled') + '>Reset to default</button>' +
      '<button type="button" class="lnk" data-ae="revert">Undo edits</button>' +
      '<button type="button" class="lnk" data-ae="preview">Preview</button>' +
      '<button type="button" class="start" data-ae="save"' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? 'One moment…' : 'Save') + '</button></div>';
    return { head: head, form: h, foot: foot };
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
    var sl = ids(val('shortlist'));
    if (sl.length) u.doctrines.shortlist = sl;
    {
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
  /* Its own window over the account screen: the head (which one, close), the sections
     down the side, the form scrolling in the middle, and the buttons along the foot.
     The scrolling box stays put between draws, so an edit does not jump the page. */
  var modal = null, lastFocus = null;
  function build() {
    modal = document.createElement('div');
    modal.className = 'ae-modal'; modal.hidden = true;
    modal.innerHTML = '<div class="ae-win" id="arch-edit" role="dialog" aria-modal="true" aria-label="Personalities">' +
      '<header class="ae-head"></header><div class="ae-body"><nav class="ae-nav" aria-label="Sections"></nav>' +
      '<div class="ae-scroll"><div class="ae"></div></div></div><footer class="ae-foot"></footer></div>';
    document.body.appendChild(modal);
    host = modal.querySelector('#arch-edit');
    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    host.querySelector('.ae-scroll').addEventListener('scroll', markNav, { passive: true });
    modal.addEventListener('mousedown', function (ev) { if (ev.target === modal) close(); });
    // (on the document, ahead of the account screen's own: a redraw can take the focus out of the window)
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !modal.hidden) { ev.stopPropagation(); ev.preventDefault(); close(); }
    }, true);
  }
  function draw() {
    if (!host) return;
    var p = html();
    host.querySelector('.ae-head').innerHTML = p.head;
    host.querySelector('.ae').innerHTML = p.form;
    host.querySelector('.ae-foot').innerHTML = p.foot;
    host.querySelector('.ae-nav').innerHTML = Array.prototype.map.call(host.querySelectorAll('.ae-sec[data-nav]'), function (x) {
      return '<button type="button" data-ae="goto" data-k="' + x.id + '">' + x.getAttribute('data-nav') + '</button>';
    }).join('');
    markNav();
  }
  // the section in view, lit in the side list
  function markNav() {
    if (!host) return;
    var sc = host.querySelector('.ae-scroll'), top = sc.getBoundingClientRect().top + 40, on = null;
    Array.prototype.forEach.call(host.querySelectorAll('.ae-sec[data-nav]'), function (x) { if (x.getBoundingClientRect().top <= top) on = x.id; });
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) { var all = host.querySelectorAll('.ae-sec[data-nav]'); if (all.length) on = all[all.length - 1].id; }
    Array.prototype.forEach.call(host.querySelectorAll('.ae-nav button'), function (b) {
      var is = b.getAttribute('data-k') === (on || 'ae-s-who');
      b.classList.toggle('on', is);
      if (is && b.scrollIntoView && host.querySelector('.ae-nav').scrollWidth > host.querySelector('.ae-nav').clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  function goTo(id) {
    var x = host.querySelector('#' + id), sc = host.querySelector('.ae-scroll');
    if (x) sc.scrollTop += x.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
  }
  function open(io) {
    api = io;
    if (!modal) build();
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('ae-open');
    if (!state.loaded) { state.loaded = true; refreshChanged(draw); }
    draw();
    var pick = host.querySelector('[data-ae="pick"]'); if (pick) pick.focus();
  }
  // (the draft is kept: opened again, the edits are still there until undone or saved)
  function close() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('ae-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest('[data-ae]');
    if (!b) return;
    var a = b.getAttribute('data-ae');
    state.fault = ''; state.note = '';
    if (a === 'close') { close(); return; }
    if (a === 'goto') { goTo(b.getAttribute('data-k')); return; }
    if (['add', 'del', 'addm', 'delm', 'addstage', 'delstage', 'addfat', 'delfat'].indexOf(a) >= 0) { rowAction(a, b); return; }
    if (a === 'preview') { try { preview(); } catch (e) { state.fault = e.message; } draw(); goTo('ae-s-preview'); }
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
      else v = t.value.trim() === '' ? undefined : kind === 'sel' && /^-?\d+$/.test(t.value) ? +t.value : t.value;   // (a choice of number, the command level, kept a number)
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
    else if (a === 'addstage') { u.doctrines = u.doctrines || {}; u.doctrines.stages = (u.doctrines.stages || []).concat([[]]); }
    else if (a === 'delstage') { var st = (u.doctrines.stages || []).slice(); st.splice(r, 1); if (st.length) u.doctrines.stages = st; else delete u.doctrines.stages; }
    else if (a === 'addfat') {
      u.doctrines = u.doctrines || {};
      var fa = clone(u.doctrines.fixedAt || {}), t = [1, 2, 3, 4, 5].filter(function (n) { return !(n in fa); })[0];
      if (t) { fa[t] = C().creedOf({ faction: faction() }).list[0].id; u.doctrines.fixedAt = fa; }
    }
    else if (a === 'delfat') { var fd = clone(u.doctrines.fixedAt || {}); delete fd[k]; if (Object.keys(fd).length) u.doctrines.fixedAt = fd; else delete u.doctrines.fixedAt; }
    draw();
  }
  // (a new, still empty row is kept in the draft until a unit is chosen in it)
  function putRowsKeep(path, rows) {
    var kind = ROWS[path];
    setP(draft(), path, rows.map(function (r) { return kind === 'one' ? r[0] : r.length === 1 ? r[0] : r; }));
  }
  function onChange(ev) {
    var t = ev.target;
    if (bound(t)) return;
    if (t.getAttribute('data-ae') === 'pick') { state.id = t.value; state.draft = null; state.preview = null; state.fault = ''; state.note = ''; draw(); }
    else if (t.getAttribute('data-ae-p') === 't') state.pt = +t.value;
    else if (t.getAttribute('data-ae-p') === 'pl') state.ppl = +t.value;
  }

  root.PMCArchEdit = {
    /* Opened from the server tools: `io` is { get, post } for the server, as the
       account screen talks to it. */
    open: open,
    close: close,
    isOpen: function () { return !!modal && !modal.hidden; },
    // for a test: the form read back, and the preview's text
    read: function () { return readForm(); },
    previewNow: function () { preview(); draw(); return state.preview; },
    pick: function (id) { state.id = id; state.draft = null; state.preview = null; draw(); }
  };
})(window);
