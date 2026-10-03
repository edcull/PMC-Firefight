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
  var fault = '', notice = '', busy = false;
  var linkToken = null;          // a reset link's token, while its new password is being chosen
  var lastName = '';             // the name last tried (to send an activation link again)
  var inactive = false;          // that name's account is waiting for its activation link
  var data = null;               // what the server keeps for the player, once fetched
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
  // what the server keeps for the player: their campaigns, their online campaigns, their battles
  function load() {
    data = null;
    Promise.all([get('api/campaigns'), get('api/online'), get('api/games')]).then(function (rs) {
      data = {
        campaigns: rs[0].ok ? (rs[0].j.campaigns || []).filter(function (c) { return c.kind !== 'online'; }) : [],
        online: rs[1].ok ? rs[1].j.campaigns || [] : [],
        games: rs[2].ok ? rs[2].j.games || [] : []
      };
      draw();
    }, function () { data = { campaigns: [], online: [], games: [], failed: true }; draw(); });
  }

  function when(t) {
    if (!t) return '';
    var d = new Date(t);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function msgs() {
    return (fault ? '<p class="acct-bad" role="alert">' + esc(fault) + '</p>' : '') +
      (notice ? '<p class="acct-good" role="status">' + esc(notice) + '</p>' : '');
  }
  function field(id, label, type, auto, max, value) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input class="tin" id="' + id + '" type="' + type + '" maxlength="' + max + '"' +
      (auto ? ' autocomplete="' + auto + '"' : '') + (value ? ' value="' + esc(value) + '"' : '') + '></div>';
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
    var tabs = '<div class="acct-tabs">' + tab('signin', 'Sign in') + tab('register', 'New account') + '</div>';
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
        : 'Sign in to keep your campaigns on the server, follow them to another device, and play other people.') + '</p>' +
      tabs + msgs() +
      (inactive && !reg ? '<button type="button" class="lnk acct-resend" data-acct="resend">Send the activation link again</button>' : '') +
      field('acct-name', 'Name', 'text', 'username', 24, lastName) +
      // the address only where this server sends mail (the link to activate it, a reset)
      (reg && mailOn ? field('acct-email', 'Email address', 'email', 'email', 254) : '') +
      field('acct-pass', 'Password' + (reg ? ' (at least 8 characters)' : ''), 'password', reg ? 'new-password' : 'current-password', 200) +
      goButton('go', reg ? 'Make the account' : 'Sign in');
    if (!reg && mailOn) h += '<button type="button" class="lnk acct-forgot" data-acct="mode" data-mode="forgot">Forgot password?</button>';
    return h + back;
  }
  function signedInHTML() {
    var h = msgs();                 // the screen's title is the top bar's
    if (who.guest) {
      return h + '<p class="acct-who">Playing as a guest: <b>' + esc(who.name) + '</b></p>' +
        '<p class="acct-lede">A guest has nothing kept on the server: campaigns need an account.</p>' +
        '<button type="button" class="lnk acct-signout" data-acct="out">Sign out</button>';
    }
    // who they are: the name and the address, each changed here
    if (edit === 'name') {
      h += '<div class="acct-edit">' + field('acct-newname', 'New name', 'text', 'username', 24, who.name) +
        '<div class="acct-editrow"><button type="button" class="lnk" data-acct="cancel">Cancel</button>' + goButton('rename', 'Change the name') + '</div></div>';
    } else {
      // Sign out, in line with the name
      h += '<div class="acct-line"><span>Name</span><b>' + esc(who.name) + '</b>' + editBtn('name', 'Change your name') +
        (who.admin ? '<span class="acct-tag">admin</span>' : '') + '<button type="button" class="lnk acct-signout" data-acct="out">Sign out</button></div>';
    }
    if (edit === 'email') {
      h += '<div class="acct-edit">' + field('acct-newemail', 'New email address', 'email', 'email', 254, who.email || '') +
        field('acct-pass', 'Your password', 'password', 'current-password', 200) +
        '<div class="acct-editrow"><button type="button" class="lnk" data-acct="cancel">Cancel</button>' + goButton('email', who.email ? 'Change the address' : 'Add the address') + '</div></div>';
    } else {
      h += '<div class="acct-line"><span>Email</span>' + (who.email ? '<b>' + esc(who.email) + '</b>' + editBtn('email', 'Change your email address') +
        (who.emailOk ? '' : '<span class="acct-tag">unconfirmed</span>')
        : '<em>none' + (mailOn ? ' — add one, so a forgotten password can be reset' : '') + '</em>' + editBtn('email', 'Add an email address')) + '</div>';
    }
    // what is kept, in a box of its own that scrolls when there is more than fits
    h += '<div class="acct-data">';
    if (!data) {
      h += '<p class="acct-lede">Looking up what is kept for you…</p>';
    } else {
      var row = function (main, sub, end) {
        return '<div class="acct-row"><span><b>' + esc(main) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (end ? '<em>' + esc(end) + '</em>' : '') + '</div>';
      };
      var section = function (title, rows, none) {
        return '<div class="acct-sec"><h3>' + title + '</h3>' + (rows.length ? rows.join('') : '<p class="acct-none">' + none + '</p>') + '</div>';
      };
      h += '<p class="acct-lede">Kept on this server for your account' + (data.failed ? ' (it could not be reached just now)' : '') + ':</p>';
      h += section('Campaigns', data.campaigns.map(function (c) {
        return row(c.name, (c.kind === 'hotseat' ? 'Hotseat' : 'Single player') + ' · turn ' + c.turn, when(c.updated));
      }), 'None yet. A campaign you play while signed in is kept here as well as in this browser.');
      h += section('Online campaigns', data.online.map(function (c) {
        return row(c.name, 'You are Player ' + (c.side === 'B' ? 2 : 1) + ' · turn ' + c.turn, when(c.updated));
      }), 'None yet. Start one from Multiplayer.');
      h += section('Battles', data.games.slice(0, 20).map(function (g) {
        return row(g.name, g.against ? 'against ' + g.against : '', g.result || 'under way');
      }), 'None yet.');
    }
    // what this browser keeps of its own, whoever is signed in
    var local = root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.get && root.PMC_CAMPAIGN.get();
    if (local && local.companies && local.companies.A) {
      var B = local.mode === 'hotseat' && local.companies.B;
      h += '<div class="acct-sec"><h3>In this browser</h3>' +
        '<div class="acct-row"><span><b>' + esc(local.companies.A.name + (B && B.name ? ' v ' + B.name : '')) + '</b><small>' +
        (local.mode === 'hotseat' ? 'Hotseat' : 'Single player') + ' campaign · turn ' + local.turn + '</small></span></div></div>';
    }
    return h + '</div>';
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
      '<div class="camp-top"><button type="button" class="camp-back" data-acct="back">\u2190 Back</button><h1>User Account</h1></div>' +
      '<div class="sheet acct-sheet"><div id="acct-body"></div></div>';
    document.body.appendChild(host);
    // its way back is to wherever it was opened from: Back, not home
    wireHost();
    return host;
  }
  var returnTo = null;           // the screen it was opened over, gone back to after
  function openScreen() {
    ensure();
    if (host.hidden) returnTo = ['setup', 'camp', 'lobby'].filter(function (id) { var o = el(id); return o && !o.hidden; })[0] || null;
    if (root.PMCMenu) root.PMCMenu.close();
    ['setup', 'camp', 'lobby'].forEach(function (id) { var o = el(id); if (o) o.hidden = true; });
    host.hidden = false;
    draw();
    if (root.PMC_BACKDROP) root.PMC_BACKDROP();
    if (mode === 'reset') return;
    refresh(function () { if (who && !who.guest) load(); draw(); var n = el('acct-name'); if (n && !who && !n.value) n.focus(); });
  }
  function closeScreen() {
    if (host) host.hidden = true;
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
  }

  // signed in or out: the campaign screen and the lobby follow
  function changed() {
    label();
    if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.accountChanged) root.PMC_CAMPAIGN.accountChanged();
    if (root.PMCLobby && root.PMCLobby.accountChanged) root.PMCLobby.accountChanged();
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
  function signedIn(j) {
    who = j.who; mode = 'signin'; edit = null;
    changed(); load();
  }
  function go() {
    var reg = mode === 'register', name = val('acct-name'), pass = (el('acct-pass') || {}).value || '';
    lastName = name;
    if (!name) { fault = 'Give your name.'; draw(); return; }
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
      .then(function () { who = null; data = null; edit = null; notice = ''; fault = ''; changed(); draw(); });
  }

  /* A link from one of the emails, opened: the token in the address, acted on in
     the account pane, and taken out of the address (it works once). */
  function fromLink() {
    var q;
    try { q = new root.URLSearchParams(root.location.search); } catch (e) { return; }
    var kind = ['activate', 'reset', 'confirm-email'].filter(function (k) { return q.get(k); })[0];
    if (!kind) return;
    var t = q.get(kind);
    try { q.delete(kind); var rest = q.toString(); root.history.replaceState(null, '', root.location.pathname + (rest ? '?' + rest : '') + root.location.hash); } catch (e) { }
    var show = function () { openScreen(); };
    if (kind === 'reset') { linkToken = t; mode = 'reset'; who = null; setTimeout(show, 0); return; }
    post('api/' + kind, { token: t }).then(function (r) {
      if (!r.ok) { fault = cap((r.j && r.j.error) || 'that link did not work'); }
      else if (kind === 'activate') { notice = 'Your account is active, and you are signed in.'; who = r.j.who; changed(); load(); }
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
          signedIn(j);
        });
      }
      else if (a === 'edit') { edit = b.getAttribute('data-what'); fault = ''; notice = ''; draw(); var f = el(edit === 'name' ? 'acct-newname' : 'acct-newemail'); if (f) f.focus(); }
      else if (a === 'cancel') { edit = null; fault = ''; draw(); }
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
        })
        .catch(function () { });
    }
  }

  root.PMCAccount = {
    // the screen opened, as it stands, then brought up to date
    show: function () { openScreen(); },
    refresh: function () { refresh(draw); },
    // the pane opened on one of its forms (the lobby's Forgot password)
    open: function (m) {
      if (m) { mode = m; fault = ''; notice = ''; }
      openScreen();
    },
    close: closeScreen,
    who: function () { return who; },
    label: label
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})(window);
