/* PMC 2670 — Firefight : the player's account, from the main menu

   A pane of the main menu (beside Single player and Hotseat), opened from the
   foot of it: signed out, the way to sign in or make an account; signed in, who
   they are, what the server keeps for them — campaigns, online campaigns, their
   battles — and what this browser keeps, and the way to sign out.

   Only offered when the page came from a game server (net.js online()): a page
   opened from a file has no accounts to sign in to. */
(function (root) {
  'use strict';
  var who;                       // undefined until asked; null signed out; { name, guest, admin } signed in
  var mode = 'signin', fault = '', busy = false;
  var data = null;               // what the server keeps for the player, once fetched
  function el(id) { return document.getElementById(id); }
  function esc(t) { return root.PMC.esc(t); }
  function online() { return !!(root.PMCNet && root.PMCNet.online && root.PMCNet.online()); }
  function get(path) {
    return root.fetch(path, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, code: r.status, j: j }; }, function () { return { ok: r.ok, code: r.status, j: {} }; }); });
  }

  // ask the server who this browser is (a server that cannot be reached changes nothing)
  function refresh(then) {
    if (!online() || !root.fetch) { who = null; label(); if (then) then(); return; }
    get('api/me').then(function (r) {
      if (r.code === 401) who = null;
      else if (r.ok) who = r.j.who || null;
      label(); if (then) then();
    }, function () { label(); if (then) then(); });
  }
  // the foot's button: the name signed in as, or the way to sign in
  function label() {
    var b = el('btn-menu-account');
    if (!b) return;
    b.hidden = !online();
    b.textContent = who ? who.name : 'Sign in';
    b.title = who ? 'Your account' : 'Sign in, or make an account';
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
  function signedOutHTML() {
    var tab = function (m, t) { return '<button type="button" class="lnk' + (mode === m ? ' on' : '') + '" data-acct="mode" data-mode="' + m + '">' + t + '</button>'; };
    var reg = mode === 'register';
    return '<h2 class="menu-head">' + (reg ? 'New account' : 'Sign in') + '</h2>' +
      '<p class="acct-lede">' + (reg ? 'Pick a name and a password. That is all: no email.'
        : 'Sign in to keep your campaigns on the server, follow them to another device, and play other people.') + '</p>' +
      '<div class="acct-tabs">' + tab('signin', 'Sign in') + tab('register', 'New account') + '</div>' +
      (fault ? '<p class="acct-bad" role="alert">' + esc(fault) + '</p>' : '') +
      '<div class="field"><label for="acct-name">Name</label><input class="tin" id="acct-name" type="text" maxlength="24" autocomplete="username"></div>' +
      '<div class="field"><label for="acct-pass">Password' + (reg ? ' (at least 8 characters)' : '') + '</label>' +
      '<input class="tin" id="acct-pass" type="password" maxlength="200" autocomplete="' + (reg ? 'new-password' : 'current-password') + '"></div>' +
      '<button type="button" class="start" data-acct="go"' + (busy ? ' disabled' : '') + '>' +
        (busy ? 'One moment…' : reg ? 'Make the account' : 'Sign in') + '</button>' +
      '<button type="button" class="mcard menu-back" data-menu="main">← Back</button>';
  }
  function signedInHTML() {
    var h = '<h2 class="menu-head">Account</h2>' +
      '<p class="acct-who">' + (who.guest ? 'Playing as a guest:' : 'Signed in as') + ' <b>' + esc(who.name) + '</b>' + (who.admin ? ' <span class="acct-tag">admin</span>' : '') + '</p>';
    if (who.guest) {
      h += '<p class="acct-lede">A guest has nothing kept on the server: campaigns need an account.</p>';
    } else if (!data) {
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
      var games = data.games.slice(0, 6);
      h += section('Battles', games.map(function (g) {
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
    h += '<button type="button" class="lnk acct-out" data-acct="out">Sign out</button>' +
      '<button type="button" class="mcard menu-back" data-menu="main">← Back</button>';
    return h;
  }
  function draw() {
    var pane = el('menu-account');
    if (!pane || pane.hidden) return;
    pane.innerHTML = who ? signedInHTML() : signedOutHTML();
  }

  // signed in or out: the campaign screen and the lobby follow
  function changed() {
    label();
    if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.accountChanged) root.PMC_CAMPAIGN.accountChanged();
    if (root.PMCLobby && root.PMCLobby.accountChanged) root.PMCLobby.accountChanged();
  }
  function signIn() {
    var name = (el('acct-name') || {}).value || '', pass = (el('acct-pass') || {}).value || '';
    if (!name.trim()) { fault = 'Give your name.'; draw(); return; }
    busy = true; fault = ''; draw();
    root.fetch(mode === 'register' ? 'api/register' : 'api/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password: pass })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (got) {
        busy = false;
        if (!got.ok) { fault = (got.j && got.j.error) || 'That did not work.'; fault = fault.charAt(0).toUpperCase() + fault.slice(1) + '.'; draw(); return; }
        who = got.j.who; mode = 'signin';
        changed(); load(); draw();
      })
      .catch(function () { busy = false; fault = 'The server could not be reached.'; draw(); });
  }
  function signOut() {
    root.fetch('api/logout', { method: 'POST', credentials: 'same-origin' }).catch(function () { })
      .then(function () { who = null; data = null; changed(); draw(); });
  }

  function wire() {
    var pane = el('menu-account');
    if (!pane) return;
    pane.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-acct]');
      if (!b) return;
      var a = b.getAttribute('data-acct');
      if (a === 'mode') { mode = b.getAttribute('data-mode'); fault = ''; draw(); }
      else if (a === 'go') signIn();
      else if (a === 'out') signOut();
    });
    pane.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target && (ev.target.id === 'acct-name' || ev.target.id === 'acct-pass')) { ev.preventDefault(); signIn(); }
    });
    refresh();
  }

  root.PMCAccount = {
    // the pane opened (menu.js): drawn as it stands, then brought up to date
    shown: function () {
      draw();
      refresh(function () { if (who && !who.guest) load(); draw(); var n = el('acct-name'); if (n && !who) n.focus(); });
    },
    refresh: function () { refresh(draw); },
    who: function () { return who; },
    label: label
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})(window);
