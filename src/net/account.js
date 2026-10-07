/* PMC 2670 — Firefight : the player's account, from the main menu

   A screen of its own, laid out as the Multiplayer and Campaign screens are (a
   bar across the top with the way back and its title, the menu's table behind
   it on a desktop), opened from the main menu's foot. Signed out: sign in, make an account (a name, an email address and
   a password; where the server sends mail, the account waits for the link mailed
   to it), or have a password-reset link sent. Signed in: who they are — the name
   and the address, either changed here — what the server keeps for them, what
   this browser keeps, and the way to sign out.

   The links in those emails open the game with ?activate=, ?reset= or
   ?confirm-email= and the link's token: read here as the page loads, and acted
   on in this pane.

   Only live once the game server answers (its /health, as the Multiplayer card
   waits for): a page opened from a file, or the static copy on GitHub Pages, has
   no accounts to sign in to, so the chip is shown greyed out and saying why. */
(function (root) {
  'use strict';
  var who;                       // undefined until asked; null signed out; { name, guest, admin, email, emailOk } signed in
  var mailOn = false;            // whether this server sends mail (and so new accounts wait for their link)
  var mode = 'signin';           // signed out: 'signin', 'register', 'forgot', 'sent' (a message), 'reset' (a new password)
  var edit = null;               // signed in: 'name' or 'email' being changed
  /* An admin's tools (server/adminapi.js), opened from their account: what the
     server holds, as last fetched, and the removal waiting on their password. */
  var adminOpen = false, adminData = null, adminAsk = null;
  var adminView = '';            // '' the server tools; 'arch' the personality editor (archedit.js)
  var fault = '', notice = '', busy = false;
  var linkToken = null;          // a reset link's token, while its new password is being chosen
  var lastName = '';             // the name last tried (to send an activation link again)
  var inactive = false;          // that name's account is waiting for its activation link
  function el(id) { return document.getElementById(id); }
  function esc(t) { return root.PMC.esc(t); }
  // a page served over http, and a game server behind it that has answered
  var serverUp = false;
  function online() { return serverUp && !!(root.PMCNet && root.PMCNet.online && root.PMCNet.online()); }
  function val(id) { return ((el(id) || {}).value || '').trim(); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.'); }
  function get(path) {
    return root.fetch(path, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; }); });
  }
  function post(path, body) {
    return root.fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; }); });
  }

  /* The personalities as this server's admin has changed them (server/archetypes.js),
     laid over the ones this page carries, so its skirmish rolls and campaigns follow
     them. A server that cannot be reached leaves the defaults. */
  function personalities() {
    var C = root.PMCCamp;
    if (!C || !C.applyArchetypeChanges) return;
    get('api/archetypes').then(function (r) { if (r.ok && r.j && r.j.changes) C.applyArchetypeChanges(r.j.changes); }, function () { });
  }
  // ask the server who this browser is (a server that cannot be reached changes nothing)
  function refresh(then) {
    if (!online() || !root.fetch) { who = null; label(); if (then) then(); return; }
    get('api/me').then(function (r) {
      if (r.code === 401) who = null;
      else if (r.ok) who = r.j.who || null;
      if (r.j && r.j.mail !== undefined) mailOn = !!r.j.mail;
      label(); if (then) then();
    }, function () { label(); if (then) then(); });
  }
  /* The user chip, at the top right of the main menu's card and of the other
     screens' top bars (set-up, campaign): the name signed in as, or the way to
     sign in. */
  var USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  function label() {
    Array.prototype.forEach.call(document.querySelectorAll('.user-chip'), function (c) {
      // no server: the main menu's is shown greyed out (as the Multiplayer card is); the top bars' are not shown at all
      var onMenu = c.classList.contains('menu-chip');
      c.hidden = !onMenu && !online();
      c.disabled = !online();
      c.innerHTML = USER_ICON + '<span>' + esc(who ? who.name : 'Sign in') + '</span>';
      c.title = !online() ? 'Online accounts unavailable'
        : who ? 'Your account' : 'Sign in, or make an account';
    });
  }
  function msgs() {
    return (fault ? '<p class="acct-bad" role="alert">' + esc(fault) + '</p>' : '') +
      (notice ? '<p class="acct-good" role="status">' + esc(notice) + '</p>' : '');
  }
  function field(id, label, type, auto, max, value) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input class="tin" id="' + id + '" type="' + type + '" maxlength="' + max + '"' +
      (auto ? ' autocomplete="' + auto + '"' : '') + (value ? ' value="' + esc(value) + '"' : '') + '></div>';
  }
  // an edit's buttons: Cancel (`cancel` its act), and the one that does it
  function editRow(cancel, act, text) {
    return '<div class="acct-editrow"><button type="button" class="lnk" data-acct="' + cancel + '">Cancel</button>' + goButton(act, text) + '</div>';
  }
  function goButton(act, text) {
    return '<button type="button" class="start" data-acct="' + act + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'One moment…' : text) + '</button>';
  }
  var back = '';                 // the way back is the top bar's
  // a small pencil: change the line it follows
  var PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  function editBtn(what, label) {
    return '<button type="button" class="acct-editbtn" data-acct="edit" data-what="' + what + '" title="' + label + '" aria-label="' + label + '">' + PENCIL + '</button>';
  }

  function signedOutHTML() {
    var tab = function (m, t) { return '<button type="button" class="lnk' + (mode === m ? ' on' : '') + '" data-acct="mode" data-mode="' + m + '">' + t + '</button>'; };
    // opened on the way into multiplayer: a guest may play a one-off battle without an account
    var tabs = '<div class="acct-tabs">' + tab('signin', 'Sign in') + tab('register', 'New account') +
      (purpose && purpose.guest ? tab('guest', 'Play as a guest') : '') + '</div>';
    if (mode === 'guest' && purpose && purpose.guest) {
      return '<h2 class="acct-head">Play as a guest</h2><p class="acct-lede">A one-off battle without an account. Campaigns need one.</p>' +
        tabs + msgs() + field('acct-name', 'Your name for this battle', 'text', 'username', 24, lastName) +
        goButton('guest', 'Play as a guest') + back;
    }
    if (mode === 'sent') {
      return '<h2 class="acct-head">Check your email</h2>' + msgs() +
        '<button type="button" class="lnk" data-acct="mode" data-mode="signin">Back to signing in</button>' + back;
    }
    if (mode === 'reset') {
      return '<h2 class="acct-head">A new password</h2><p class="acct-lede">Choose the new password for your account.</p>' + msgs() +
        field('acct-pass', 'New password (at least 8 characters)', 'password', 'new-password', 200) +
        goButton('reset', 'Set the new password') + back;
    }
    if (mode === 'forgot') {
      return '<h2 class="acct-head">Forgot password</h2>' +
        '<p class="acct-lede">Give the email address of your account, and a link to choose a new password is sent to it.</p>' + msgs() +
        field('acct-email', 'Email address', 'email', 'email', 254) +
        goButton('forgot', 'Send me a link') +
        '<button type="button" class="lnk" data-acct="mode" data-mode="signin">Back to signing in</button>' + back;
    }
    var reg = mode === 'register';
    var h = '<h2 class="acct-head">' + (reg ? 'New account' : 'Sign in') + '</h2>' +
      '<p class="acct-lede">' + (reg ? (mailOn ? 'A name, your email address and a password. A link to activate the account is sent to the address.' : 'A name and a password.')
        : purpose && purpose.lede ? purpose.lede : 'Sign in to keep your campaigns on the server, follow them to another device, and play other people.') + '</p>' +
      tabs + msgs() +
      (inactive && !reg ? '<button type="button" class="lnk acct-resend" data-acct="resend">Send the activation link again</button>' : '') +
      // where the server sends mail, an account signs in with its email address (its name still works)
      (!reg && mailOn ? field('acct-name', 'Email address', 'text', 'username', 254, lastName) : field('acct-name', 'Name', 'text', 'username', 24, lastName)) +
      // the address only where this server sends mail (the link to activate it, a reset)
      (reg && mailOn ? field('acct-email', 'Email address', 'email', 'email', 254) : '') +
      field('acct-pass', 'Password' + (reg ? ' (at least 8 characters)' : ''), 'password', reg ? 'new-password' : 'current-password', 200) +
      goButton('go', reg ? 'Make the account' : 'Sign in');
    if (!reg && mailOn) h += '<button type="button" class="lnk acct-forgot" data-acct="mode" data-mode="forgot">Forgot password?</button>';
    return h + back;
  }
  function when(t) { if (!t) return '-'; var d = new Date(t); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toTimeString().slice(0, 5); }
  function adminHTML() {
    if (adminView === 'arch') {
      return msgs() + '<div class="acct-line"><span>Admin</span><b>Personalities</b><button type="button" class="lnk acct-signout" data-acct="admin-tools">Server tools</button></div>' +
        '<div id="arch-edit"></div>';
    }
    var h = msgs() + '<div class="acct-line"><span>Admin</span><b>Server tools</b><button type="button" class="lnk acct-signout" data-acct="admin-close">Done</button></div>';
    if (!adminData) return h + '<p class="acct-lede">Looking at the server\u2026</p>';
    var d = adminData, st = d.stats || {}, he = d.health || {};
    var btn = function (act, key, label, danger) { return '<button type="button" class="lnk' + (danger ? ' acct-danger' : '') + '" data-acct="adm" data-act="' + act + '" data-key="' + esc(key) + '">' + label + '</button>'; };
    var asking = function (act, key) { return adminAsk && adminAsk.act === act && String(adminAsk.key) === String(key); };
    // a removal: the admin's own password again (a backup is taken first)
    var confirm = function () {
      return '<div class="acct-edit">' + field('acct-admpass', 'Your password, to remove ' + esc(adminAsk.label) + ' (a backup is taken first)', 'password', 'current-password', 200) +
        editRow('adm-cancel', 'adm-confirm', 'Remove it') + '</div>';
    };
    h += '<div class="acct-data">';
    h += '<div class="acct-sec"><h3>Server</h3><div class="acct-row"><span><b>' + [(st.users || 0) + ' account' + (st.users === 1 ? '' : 's')].concat(Object.keys(st.games || {}).map(function (k) { return st.games[k] + ' ' + (k === 'battle' ? 'under way' : k); })).join(', ') + '</b>' +
      '<small>Up ' + Math.round((he.up || 0) / 3600) + ' h \u00b7 email ' + (he.mail ? 'on' : 'off') + ' \u00b7 last backup ' + (he.backup ? when(Date.parse(he.backup)) : 'none') + '</small></span>' +
      '<em>' + btn('backup', '', 'Back up now') + ' ' + btn('prune', '30', 'Clear finished battles over 30 days') + '</em></div></div>';
    // the personalities: what each kind of force fields and how it fights, as this server has them
    h += '<div class="acct-sec"><h3>Personalities</h3><div class="acct-row"><span><b>How each kind of force is built and fights</b>' +
      '<small>Weighted unit lists, tier preference, hulls, temper, tactics, doctrines — with a preview</small></span><em>' +
      '<button type="button" class="lnk" data-acct="admin-arch">Edit personalities</button></em></div></div>';
    h += '<div class="acct-sec"><h3>Accounts</h3>' + (d.users || []).map(function (u) {
      var row = '<div class="acct-row"><span><b>' + esc(u.name) + (u.admin ? ' <i class="acct-tag">admin</i>' : '') + '</b><small>' +
        esc(u.email || 'no email') + (u.email && !u.emailOk ? ' (unconfirmed)' : '') + (u.active ? '' : ' \u00b7 not activated') + ' \u00b7 last seen ' + when(u.seen) + '</small></span><em>' +
        (u.active ? '' : btn('activate', u.name, 'Activate') + ' ' + (u.email ? btn('resend', u.name, 'Resend link') + ' ' : '')) +
        (u.email && u.active ? btn('reset-link', u.name, 'Send reset link') + ' ' : '') +
        (u.admin || u.name === who.name ? '' : btn('delete-user', u.name, 'Remove', true)) + '</em></div>';
      return row + (asking('delete-user', u.name) ? confirm() : '');
    }).join('') + '</div>';
    h += '<div class="acct-sec"><h3>Battles</h3>' + ((d.games || []).length ? d.games.map(function (g) {
      var how = g.status === 'battle' ? 'under way' + (g.open ? ', open' : '') : g.winner ? 'won by ' + g.winner + (g.forfeit ? ' (forfeit)' : '') : g.status;
      var row = '<div class="acct-row"><span><b>' + esc(g.code) + ' \u00b7 ' + esc(g.players.map(function (n) { return n || '(empty)'; }).join(' v ')) + '</b><small>' +
        esc(g.kind) + ' \u00b7 ' + esc(how) + ' \u00b7 ' + g.moves + ' moves \u00b7 ' + when(g.updated) + '</small></span><em>' +
        (g.status === 'battle' ? btn('close-game', g.code, 'Close') + ' ' : '') + btn('delete-game', g.code, 'Remove', true) + '</em></div>';
      return row + (asking('delete-game', g.code) ? confirm() : '');
    }).join('') : '<p class="acct-none">None.</p>') + '</div>';
    h += '<div class="acct-sec"><h3>Campaigns</h3>' + ((d.campaigns || []).length ? d.campaigns.map(function (c) {
      var who2 = c.players ? c.players.map(function (m) { return m.name + ' (' + m.side + ')'; }).join(' & ') + (c.invite ? ' \u00b7 code ' + c.invite + ' open' : '') : 'owner ' + (c.owner || '?');
      var row = '<div class="acct-row"><span><b>' + esc(c.name) + '</b><small>' + esc(c.kind) + ' \u00b7 turn ' + c.turn + ' \u00b7 ' + esc(who2) + ' \u00b7 ' + when(c.updated) + '</small></span><em>' +
        btn('delete-campaign', c.id, 'Remove', true) + '</em></div>';
      return row + (asking('delete-campaign', c.id) ? confirm() : '');
    }).join('') : '<p class="acct-none">None.</p>') + '</div>';
    return h + '</div>';
  }
  function adminLoad() {
    get('api/admin/overview').then(function (r) {
      if (!r.ok) { fault = cap((r.j && r.j.error) || 'the server said no'); adminOpen = false; draw(); return; }
      adminData = r.j; draw();
    }, function () { fault = 'The server could not be reached.'; draw(); });
  }
  // an admin action: a removal asks for the password first; the rest go at once
  function adminDo(act, key, password) {
    var body = { name: key, code: key, id: key, days: key, password: password };
    send('api/admin/' + act, body, function (j) {
      if (!j) return;
      adminAsk = null; notice = j.text || 'Done.';
      adminLoad();
    });
  }
  function signedInHTML() {
    if (adminOpen && who && who.admin) return adminHTML();
    var h = msgs();                 // the screen's title is the top bar's
    if (who.guest) {
      return h + '<p class="acct-who">Playing as a guest: <b>' + esc(who.name) + '</b></p>' +
        '<p class="acct-lede">A guest has nothing kept on the server: campaigns need an account.</p>' +
        '<button type="button" class="lnk acct-signout" data-acct="out">Sign out</button>';
    }
    // who they are: the name and the address, each changed here
    if (edit === 'name') {
      h += '<div class="acct-edit">' + field('acct-newname', 'New name', 'text', 'username', 24, who.name) +
        editRow('cancel', 'rename', 'Change the name') + '</div>';
    } else {
      // Sign out, in line with the name
      h += '<div class="acct-line"><span>Name</span><b>' + esc(who.name) + '</b>' + editBtn('name', 'Change your name') +
        (who.admin ? '<span class="acct-tag">admin</span>' : '') + '<button type="button" class="lnk acct-signout" data-acct="out">Sign out</button></div>';
    }
    if (edit === 'email') {
      h += '<div class="acct-edit">' + field('acct-newemail', 'New email address', 'email', 'email', 254, who.email || '') +
        field('acct-pass', 'Your password', 'password', 'current-password', 200) +
        editRow('cancel', 'email', who.email ? 'Change the address' : 'Add the address') + '</div>';
    } else {
      h += '<div class="acct-line"><span>Email</span>' + (who.email ? '<b>' + esc(who.email) + '</b>' + editBtn('email', 'Change your email address') +
        (who.emailOk ? '' : '<span class="acct-tag">unconfirmed</span>')
        : '<em>none' + (mailOn ? ' — add one, so a forgotten password can be reset' : '') + '</em>' + editBtn('email', 'Add an email address')) + '</div>';
    }
    // where this server sends mail: an email when an online campaign is waiting on them, if they want one
    if (mailOn) {
      h += '<div class="acct-line"><span>Emails</span><label class="acct-check"><input type="checkbox" data-acct="notify"' + (who.notify ? ' checked' : '') +
        (who.email ? '' : ' disabled') + '> When an online campaign is waiting on me' + (who.email ? '' : ' (add an address first)') + '</label></div>';
    }
    // an admin's tools: the server, the accounts, the battles and the campaigns
    if (who.admin) h += '<div class="acct-line"><span>Admin</span><button type="button" class="lnk" data-acct="admin-open">Server tools</button></div>';
    // the password: changed here with the current one, or (forgotten) a reset link sent to the address
    if (edit === 'pass') {
      h += '<div class="acct-edit">' + field('acct-oldpass', 'Current password', 'password', 'current-password', 200) +
        field('acct-newpass', 'New password (at least 8 characters)', 'password', 'new-password', 200) +
        editRow('cancel', 'pass', 'Change the password') +
        (mailOn && who.email ? '<button type="button" class="lnk acct-forgot" data-acct="sendreset">Forgotten it? Email me a reset link</button>' : '') + '</div>';
    } else {
      h += '<div class="acct-line"><span>Password</span><b>\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</b>' + editBtn('pass', 'Change your password') + '</div>';
    }
    return h;
  }
  /* ================= the screen ================= */
  var host = null;
  function ensure() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'overlay acct';
    host.id = 'account';
    host.hidden = true;
    host.innerHTML = '<canvas id="account-table" aria-hidden="true"></canvas>' +
      '<div class="camp-top">' + root.PMCUi.backButton('data-acct="back"') + '<h1>User Account</h1></div>' +
      '<div class="sheet acct-sheet"><div id="acct-body"></div></div>';
    document.body.appendChild(host);
    // its way back is to wherever it was opened from: Back, not home
    wireHost();
    return host;
  }
  var returnTo = null;           // the screen it was opened over, gone back to after
  /* Opened to sign in on the way somewhere (Multiplayer): where to go once signed
     in, and whether a guest may go there. Cleared on the way out. */
  var purpose = null;
  function openScreen() {
    ensure();
    if (host.hidden) returnTo = ['setup', 'camp', 'lobby'].filter(function (id) { var o = el(id); return o && !o.hidden; })[0] || null;
    if (root.PMCMenu) root.PMCMenu.close();
    ['setup', 'camp', 'lobby'].forEach(function (id) { var o = el(id); if (o) o.hidden = true; });
    host.hidden = false;
    draw();
    if (root.PMC_BACKDROP) root.PMC_BACKDROP();
    if (mode === 'reset') return;
    refresh(function () { draw(); var n = el('acct-name'); if (n && !who && !n.value) n.focus(); });
  }
  function closeScreen() {
    if (host) host.hidden = true;
    purpose = null; adminOpen = false; adminAsk = null;
    if (mode === 'guest') mode = 'signin';
    var back = returnTo; returnTo = null;
    // back where it was opened from (the set-up, the campaign, the lobby), or the main menu
    if (back === 'lobby' && root.PMCLobby) root.PMCLobby.open();
    else if (back && el(back)) { el(back).hidden = false; if (back === 'camp' && root.PMC_CAMPAIGN) root.PMC_CAMPAIGN.open(); }
    else if (root.PMCMenu) root.PMCMenu.open();
    if (root.PMC_BACKDROP) root.PMC_BACKDROP();
  }
  function draw() {
    var body = el('acct-body');
    if (!body || !host || host.hidden) return;
    body.innerHTML = who ? signedInHTML() : signedOutHTML();
    // the personality editor keeps its own form, drawn into the pane once it is there
    if (adminOpen && adminView === 'arch' && el('arch-edit') && root.PMCArchEdit) root.PMCArchEdit.mount(el('arch-edit'), { get: get, post: post });
  }

  // signed in or out: the campaign screen and the lobby follow
  function changed() {
    label();
    if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.accountChanged) root.PMC_CAMPAIGN.accountChanged();
    if (root.PMCLobby && root.PMCLobby.accountChanged) root.PMCLobby.accountChanged();
    // saved forces: the account's, fetched for whoever signed in (none for nobody)
    if (root.PMCForces) root.PMCForces.refresh();
    // the Continue list: the server's games are the account's, so asked for afresh
    if (root.PMCMenu && root.PMCMenu.refresh) root.PMCMenu.refresh();
  }
  // a request from a form: busy while it is out, and its refusal said
  function send(path, body, done) {
    busy = true; fault = ''; notice = ''; draw();
    post(path, body).then(function (r) {
      busy = false;
      if (!r.ok) { fault = cap((r.j && r.j.error) || 'that did not work'); done(null, r); draw(); return; }
      done(r.j, r);
      draw();
    }, function () { busy = false; fault = 'The server could not be reached.'; draw(); });
  }
  function signedIn(j, stay) {
    who = j.who; mode = 'signin'; edit = null;
    changed();
    // signed in on the way somewhere: on to it
    var then = purpose && purpose.then;
    if (then) { purpose = null; returnTo = null; host.hidden = true; notice = ''; then(); return; }
    // otherwise straight on to the main menu (a new password stays to say it is changed)
    if (!stay) { purpose = null; returnTo = null; host.hidden = true; notice = ''; if (root.PMCMenu) root.PMCMenu.open(); if (root.PMC_BACKDROP) root.PMC_BACKDROP(); }
  }
  function go() {
    var reg = mode === 'register', name = val('acct-name'), pass = (el('acct-pass') || {}).value || '';
    lastName = name;
    if (!name) { fault = !reg && mailOn ? 'Give your email address.' : 'Give your name.'; draw(); return; }
    if (reg) {
      var email = val('acct-email');
      if (!email && mailOn) { fault = 'Give your email address.'; draw(); return; }
      send('api/register', { name: name, email: email, password: pass }, function (j) {
        if (!j) return;
        if (j.pending) { mode = 'sent'; notice = 'Your account is made. A link to activate it has been sent to ' + j.email + ' — follow it, and you are signed in.'; return; }
        signedIn(j);
      });
      return;
    }
    inactive = false;
    send('api/login', { name: name, password: pass }, function (j, r) {
      if (j) { signedIn(j); return; }
      // not activated yet: the link may be sent again
      inactive = !!(r && r.j && r.j.inactive);
    });
  }
  /* The user chip's menu: Your account and Sign out, under the chip it was opened
     from, as the lobby's is. One for the page, placed where it is wanted. */
  var popFor = null;
  function openPop(chip) {
    var pop = el('user-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'user-pop';
      pop.className = 'user-pop';
      pop.innerHTML = '<button type="button" class="lnk" data-pop="account">Your account</button><button type="button" class="lnk" data-pop="out">Sign out</button>';
      document.body.appendChild(pop);
      pop.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-pop]');
        if (!b) return;
        var a = b.getAttribute('data-pop');
        closePop();
        if (a === 'account') openScreen(); else signOut();
      });
    }
    var r = chip.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = Math.round(r.bottom + 4) + 'px';
    pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    // a chip low on the page (the main menu's foot): the menu opens above it instead
    if (r.bottom + pop.offsetHeight + 8 > window.innerHeight) pop.style.top = Math.max(8, Math.round(r.top - pop.offsetHeight - 4)) + 'px';
    chip.setAttribute('aria-expanded', 'true');
    popFor = chip;
  }
  function closePop() {
    var pop = el('user-pop');
    if (pop) pop.hidden = true;
    if (popFor) popFor.setAttribute('aria-expanded', 'false');
    popFor = null;
  }
  function signOut() {
    root.fetch('api/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () { })
      .then(function () { who = null; edit = null; adminOpen = false; adminData = null; adminAsk = null; notice = ''; fault = ''; changed(); draw(); });
  }

  /* A link from one of the emails, opened: the token in the address, acted on in
     the account pane, and taken out of the address (it works once). */
  function fromLink() {
    var q;
    try { q = new root.URLSearchParams(root.location.search); } catch (e) { return; }
    var kind = ['activate', 'reset', 'confirm-email', 'campaign'].filter(function (k) { return q.get(k); })[0];
    if (!kind) return;
    var t = q.get(kind);
    try { q.delete(kind); var rest = q.toString(); root.history.replaceState(null, '', root.location.pathname + (rest ? '?' + rest : '') + root.location.hash); } catch (e) { }
    /* "Your move" (the email): straight into that online campaign once signed in,
       or the sign-in first and then into it. */
    if (kind === 'campaign') {
      var go = function () { if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.openOnline) root.PMC_CAMPAIGN.openOnline(+t); };
      refresh(function () {
        if (who && !who.guest) { setTimeout(go, 300); return; }
        purpose = { then: go, lede: 'Sign in to go back to your campaign.' }; mode = 'signin'; openScreen();
      });
      return;
    }
    var show = function () { openScreen(); };
    if (kind === 'reset') { linkToken = t; mode = 'reset'; who = null; setTimeout(show, 0); return; }
    post('api/' + kind, { token: t }).then(function (r) {
      if (!r.ok) { fault = cap((r.j && r.j.error) || 'that link did not work'); }
      else if (kind === 'activate') { notice = 'Your account is active, and you are signed in.'; who = r.j.who; changed(); }
      else { notice = 'Your email address is now ' + r.j.email + '.'; refresh(draw); }
      show(); draw();
    }, function () { fault = 'The server could not be reached.'; show(); draw(); });
  }

  function wireHost() {
    var pane = host;
    pane.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-acct]');
      if (!b) return;
      var a = b.getAttribute('data-acct');
      if (a === 'back') { closeScreen(); return; }
      if (a === 'mode') { mode = b.getAttribute('data-mode'); fault = ''; notice = ''; inactive = false; draw(); }
      else if (a === 'go') go();
      else if (a === 'guest') {
        var gn = val('acct-name');
        lastName = gn;
        if (!gn) { fault = 'Give your name.'; draw(); return; }
        send('api/guest', { name: gn }, function (j) { if (j) signedIn(j); });
      }
      else if (a === 'out') signOut();
      else if (a === 'resend') send('api/resend', { name: lastName }, function (j) { if (j) { inactive = false; notice = 'The activation link has been sent again \u2014 check your email.'; } });
      else if (a === 'forgot') {
        var em = val('acct-email');
        if (!em) { fault = 'Give your email address.'; draw(); return; }
        send('api/forgot', { email: em }, function (j) { if (j) { mode = 'sent'; notice = 'If an account has the address ' + em + ', a link to choose a new password is on its way to it. It works for an hour.'; } });
      }
      else if (a === 'reset') {
        send('api/reset', { token: linkToken, password: (el('acct-pass') || {}).value || '' }, function (j) {
          if (!j) return;
          linkToken = null; notice = 'Your password is changed, and you are signed in. Every other device was signed out.';
          signedIn(j, true);
        });
      }
      else if (a === 'edit') { edit = b.getAttribute('data-what'); fault = ''; notice = ''; draw(); var f = el(edit === 'name' ? 'acct-newname' : edit === 'pass' ? 'acct-oldpass' : 'acct-newemail'); if (f) f.focus(); }
      else if (a === 'cancel') { edit = null; fault = ''; draw(); }
      else if (a === 'pass') {
        send('api/password', { old: (el('acct-oldpass') || {}).value || '', password: (el('acct-newpass') || {}).value || '' }, function (j) {
          if (!j) return;
          edit = null; notice = 'Your password is changed. Every other device was signed out.';
        });
      }
      else if (a === 'admin-open') { adminOpen = true; adminData = null; adminAsk = null; fault = ''; notice = ''; draw(); adminLoad(); }
      else if (a === 'admin-close') { adminOpen = false; adminView = ''; adminAsk = null; fault = ''; notice = ''; draw(); }
      else if (a === 'admin-arch') { adminView = 'arch'; fault = ''; notice = ''; draw(); }
      else if (a === 'admin-tools') { adminView = ''; fault = ''; notice = ''; draw(); adminLoad(); }
      else if (a === 'adm') {
        var act = b.getAttribute('data-act'), key = b.getAttribute('data-key');
        fault = ''; notice = '';
        if (/^delete-/.test(act)) { adminAsk = { act: act, key: key, label: act === 'delete-user' ? key + '\u2019s account' : act === 'delete-game' ? 'battle ' + key : 'this campaign' }; draw(); var pf = el('acct-admpass'); if (pf) pf.focus(); return; }
        adminDo(act, key);
      }
      else if (a === 'adm-cancel') { adminAsk = null; fault = ''; draw(); }
      else if (a === 'adm-confirm') { if (adminAsk) adminDo(adminAsk.act, adminAsk.key, (el('acct-admpass') || {}).value || ''); }
      else if (a === 'notify') {
        var on = !!b.checked;
        send('api/notify', { on: on }, function (j) { if (j) { who.notify = on; notice = on ? 'You will be emailed when an online campaign is waiting on you.' : 'No more emails about your campaigns.'; } else b.checked = !on; });
      }
      else if (a === 'sendreset') {
        send('api/forgot', { email: who.email }, function (j) { if (j) { edit = null; notice = 'A link to choose a new password has been sent to ' + who.email + '. It works for an hour.'; } });
      }
      else if (a === 'rename') {
        send('api/rename', { name: val('acct-newname') }, function (j) {
          if (!j) return;
          who = j.who; edit = null; notice = 'Your name is now ' + who.name + '.';
          changed();
        });
      }
      else if (a === 'email') {
        send('api/email', { email: val('acct-newemail'), password: (el('acct-pass') || {}).value || '' }, function (j) {
          if (!j) return;
          edit = null;
          if (j.pending) notice = 'A link has been sent to ' + j.email + '. Follow it to make it your address; until then the old one stays.';
          else { notice = 'Your email address is now ' + j.email + '.'; who.email = j.email; who.emailOk = false; }
        });
      }
    });
    pane.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !ev.target || ev.target.tagName !== 'INPUT') return;
      ev.preventDefault();
      var btn = pane.querySelector('.start[data-acct]');
      if (btn) btn.click();
    });
    pane.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && ev.target.tagName !== 'INPUT') closeScreen(); });
  }
  function wire() {
    // the user chip, on the main menu's card and the other screens' top bars, opens it
    document.addEventListener('click', function (ev) {
      var chip = ev.target.closest && ev.target.closest('.user-chip');
      var pop = el('user-pop');
      if (pop && !pop.hidden && !(ev.target.closest && ev.target.closest('#user-pop')) && chip !== popFor) closePop();
      if (!chip) return;
      // the main menu's goes straight to the account; the top bars': signed in, a little menu under it (as the lobby's)
      if (chip.classList.contains('menu-chip')) { openScreen(); return; }
      if (who) { if (pop && !pop.hidden && popFor === chip) closePop(); else openPop(chip); }
      else openScreen();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePop(); });
    label();
    // the server's own /health, relative to the page (it may sit on a sub-path): answered, accounts are live
    if (root.fetch && root.PMCNet && root.PMCNet.online && root.PMCNet.online()) {
      root.fetch('health', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (h) {
          if (!(h && h.ok === true && h.rooms != null)) return;
          serverUp = true;
          refresh();
          fromLink();
          personalities();
        })
        .catch(function () { });
    }
  }

  root.PMCAccount = {
    USER_ICON: USER_ICON,   // the person on the top bars' account buttons, the lobby's too
    // the screen opened, as it stands, then brought up to date
    show: function () { openScreen(); },
    refresh: function () { refresh(draw); },
    // the pane opened on one of its forms (the lobby's Forgot password)
    open: function (m) {
      if (m) { mode = m; fault = ''; notice = ''; }
      openScreen();
    },
    close: closeScreen,
    /* Sign in on the way somewhere (the lobby): the screen opened on signing in,
       `then` called once signed in; Back goes to the main menu.
       opts: { then, guest (a guest's name will do), lede } */
    signIn: function (opts) {
      purpose = opts || {};
      mode = 'signin'; fault = purpose.fault || ''; notice = '';
      openScreen();
      returnTo = null;
    },
    who: function () { return who; },
    label: label
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})(window);
