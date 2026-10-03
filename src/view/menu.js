/* The main menu: the first screen, and the one every "back" leads to.

   Single player and Hotseat each open a list of their own — a skirmish, co-op
   or solitaire, and a campaign — and Multiplayer goes straight to the lobby,
   which asks the same when a game is started. Every card hands over to the screen that
   already does the job — the muster sheet, the campaign dossier, the lobby —
   so this file only decides which one to open and how it is set up.

   Behind it, a table rolled from the book's generators and drawn by the
   board's own renderer. Every few seconds the next world in the list is
   rolled afresh and fades in over the last, and now and then a pair of
   interceptors goes over. */
(function (root) {
  'use strict';

  var R = root.PMC, ISO = root.PMCIso, GEN = root.PMCGen;
  var WORLDS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
  var EVERY = 10000;            // a new table this often, in ms: long enough to take one in
  var FADE = 1600;              // and this long to fade it in
  var SCALE = 0.5;              // a table is kept at half size: it is a backdrop
  var PASS = 3800;              // how long a pair of interceptors takes to cross, in ms
  var FLYBY = 0.35;             // the chance of a pair going over, each new table

  function el(id) { return document.getElementById(id); }

  /* ================= navigation ================= */
  var PANES = ['main', 'single', 'hotseat', 'continue'];
  // where Back (and Escape) goes from each list
  var UP = { single: 'main', hotseat: 'main', continue: 'main' };
  var at = 'main';

  function show(pane) {
    if (PANES.indexOf(pane) < 0) pane = 'main';
    at = pane;
    PANES.forEach(function (p) { var e = el('menu-' + p); if (e) e.hidden = p !== pane; });
    // the foot: the demo under the main menu only
    var d = el('btn-menu-demo');
    if (d) d.hidden = pane !== 'main';
    if (pane === 'continue') { drawList(); fetchRemote(true); }
  }

  function open(pane) {
    var m = el('menu');
    if (!m) return;
    ['setup', 'camp', 'lobby', 'account'].forEach(function (id) { var o = el(id); if (o) o.hidden = true; });
    // a demo is not kept to come back to: back at the menu, it is over
    if (root.PMC_DROP_DEMO) root.PMC_DROP_DEMO();
    m.hidden = false;
    show(pane || 'main');
    paint();
    Table.start();
  }
  function close() {
    var m = el('menu');
    if (m) m.hidden = true;
    if (Table.on() === el('menu-table')) Table.stop();
    // a demo paused behind the menu picks up again
    try { root.dispatchEvent(new Event('pmc-menu-closed')); } catch (e) { }
  }
  function isOpen() { var m = el('menu'); return !!m && !m.hidden; }

  /* What the cards say depends on what there is to go back to. */
  function paint() {
    if (root.PMCAccount) root.PMCAccount.label();
    var live = root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE();
    el('btn-resume').hidden = !live;
    // games under way: the Continue card, and the list behind it if it is open
    contCard();
    if (at === 'continue') drawList();
    fetchRemote(false);
    /* a skirmish in this browser can be thrown away, and a battle over the
       network abandoned; asked twice, since neither can be had back */
    var dis = el('btn-discard');
    if (dis) {
      dis.hidden = !live || !(discardable() || abandonable());
      unconfirm();
    }
    var ms = el('menu-multi-sub');
    if (ms && !live && root.PMCLobby && root.PMCLobby.resumable && !root.PMCLobby.resumable() && /^Resume/.test(ms.textContent)) {
      ms.textContent = 'Play somebody else over the network';
    }
  }

  /* ================= games under way =================
     Every game there is to go back to: the battles and campaigns kept in this
     browser, and — signed in on a server — the account's campaigns not kept
     here, its online campaigns and its battles online still being fought. One
     tapped is picked up; one of this browser's can be put away (asked twice). */
  var remote = { battles: [], online: [], account: [] }, remoteAt = 0, remoteBusy = false;
  function fetchRemote(now) {
    if (remoteBusy || !root.fetch || !root.PMCLobby || !root.PMCLobby.available || !root.PMCLobby.available()) return;
    if (!now && Date.now() - remoteAt < 15000) return;
    remoteBusy = true; remoteAt = Date.now();
    var get = function (u) {
      return root.fetch(u, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    };
    var acct = root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.accountList ? Promise.resolve(root.PMC_CAMPAIGN.accountList()).catch(function () { return []; }) : Promise.resolve([]);
    Promise.all([get('api/games'), get('api/online'), acct]).then(function (rs) {
      remoteBusy = false;
      remote = {
        // an online campaign's battle is gone back to through the campaign
        battles: (rs[0].games || []).filter(function (g) { return g.status === 'battle' && !g.campaign; }),
        online: rs[1].campaigns || [],
        account: rs[2] || []
      };
      contCard();
      if (at === 'continue' && isOpen()) drawList();
    }, function () { remoteBusy = false; });
  }
  var KINDS = { ai: 'Skirmish', solo: 'Solitaire', hotseat: 'Hotseat skirmish', coop: 'Co-op', demo: 'Demo' };
  function ago(t) {
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString();
  }
  function scenName(id) { var C = root.PMCCamp; return (C && C.SCENARIO_NAMES && C.SCENARIO_NAMES[id]) || ''; }
  function games() {
    var out = [], liveId = root.PMC_BATTLE_ID && root.PMC_BATTLE_ID();
    var battles = (root.PMCNet && root.PMCNet.savedBattles && root.PMCNet.savedBattles()) || [];
    // a campaign's own battle is gone back to through its campaign
    battles.filter(function (b) { return !b.campaign; }).forEach(function (b) {
      out.push({ key: 'b:' + b.id, kind: KINDS[b.mode] || 'Skirmish', live: b.id === liveId,
        name: (b.nameA || 'Your force') + (b.nameB ? ' v ' + b.nameB : ''),
        sub: [b.id === liveId ? 'On the table now' : '', scenName(b.scenario), b.turn ? 'turn ' + b.turn : 'setting up', ago(b.at)].filter(Boolean).join(' \u00b7 '),
        at: b.at || 0, del: true });
    });
    var camps = (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.list && root.PMC_CAMPAIGN.list()) || [];
    camps.forEach(function (c) {
      var fought = battles.some(function (b) { return b.campaign && b.campLid === c.lid; });
      out.push({ key: 'c:' + c.lid, kind: (c.mode === 'hotseat' ? 'Hotseat campaign' : 'Campaign'), name: c.name,
        sub: [c.over ? 'over' : 'campaign turn ' + (c.turn || 0), fought ? 'a battle under way' : '', ago(c.at)].filter(Boolean).join(' \u00b7 '),
        at: c.at || 0, del: true });
    });
    remote.account.forEach(function (c) {
      out.push({ key: 'a:' + c.sid, kind: (c.mode === 'hotseat' ? 'Hotseat campaign' : 'Campaign') + ' \u00b7 your account', name: c.name,
        sub: ['campaign turn ' + (c.turn || 0), ago(c.updated)].filter(Boolean).join(' \u00b7 '), at: c.updated || 0 });
    });
    remote.online.forEach(function (c) {
      out.push({ key: 'o:' + c.id, kind: 'Online campaign', name: c.name,
        sub: ['Player ' + (c.side === 'B' ? 2 : 1), 'campaign turn ' + (c.turn || 0), ago(c.updated)].join(' \u00b7 '), at: c.updated || 0 });
    });
    remote.battles.forEach(function (g) {
      out.push({ key: 'g:' + g.code, kind: 'Online skirmish', name: g.name,
        sub: [g.against ? 'against ' + g.against : '', ago(g.at)].filter(Boolean).join(' \u00b7 '), at: g.at || 0 });
    });
    return out.sort(function (a, b) { return (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.at - a.at; });
  }
  function contCard() {
    var c = el('btn-continue');
    if (!c) return;
    var all = games();
    c.hidden = !all.length;
    var sub = el('menu-continue-sub');
    if (sub) sub.textContent = all.length === 1 ? all[0].kind + ': ' + all[0].name : all.length + ' games under way';
  }
  var delAsked = null;
  function drawList() {
    var box = el('cont-list');
    if (!box) return;
    var all = games(), esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
    box.innerHTML = all.length ? all.map(function (g) {
      var asked = delAsked === g.key;
      return '<div class="cont-row"><button class="mcard' + (g.live ? ' live' : '') + '" data-cont="' + esc(g.key) + '">' +
        '<span class="cont-kind">' + esc(g.kind) + '</span><b>' + esc(g.name) + '</b><small>' + esc(asked ? 'Tap Delete? to put it away — it cannot be had back' : g.sub) + '</small></button>' +
        (g.del ? '<button class="resume-x' + (asked ? ' confirm' : '') + '" data-contdel="' + esc(g.key) + '" aria-label="Put this away" title="Put this away">' + (asked ? 'Delete?' : '\u2715') + '</button>' : '') +
        '</div>';
    }).join('') : '<p class="cont-none">Nothing under way.</p>';
  }
  function pick(key) {
    var kind = key.slice(0, 1), id = key.slice(2), n = el('menu-note');
    if (n) n.hidden = true;
    if (kind === 'b') {
      if (root.PMC_RESUME_BATTLE && root.PMC_RESUME_BATTLE(id)) return;
      if (n) {
        n.textContent = abandonable() ? 'A battle is still being fought online. See it through, or abandon it, before picking up another.'
          : 'That battle could not be picked up again.';
        n.hidden = false;
      }
      paint();
      return;
    }
    if (kind === 'c') { if (root.PMC_CAMPAIGN) root.PMC_CAMPAIGN.resume(id); return; }
    if (kind === 'a') { if (root.PMC_CAMPAIGN) root.PMC_CAMPAIGN.adopt(id); return; }
    if (kind === 'o') { if (root.PMC_CAMPAIGN) { close(); root.PMC_CAMPAIGN.openOnline(+id); } return; }
    if (kind === 'g') {
      if (!freshOk()) return;
      close();
      if (root.PMCLobby && root.PMCLobby.rejoin) root.PMCLobby.rejoin(id);
    }
  }
  function drop(key) {
    var kind = key.slice(0, 1), id = key.slice(2);
    if (kind === 'b') {
      if (root.PMC_BATTLE_ID && root.PMC_BATTLE_ID() === id && root.PMC_DISCARD_BATTLE) root.PMC_DISCARD_BATTLE();
      if (root.PMCNet && root.PMCNet.forgetBattle) root.PMCNet.forgetBattle(id);
    } else if (kind === 'c') {
      // its battle goes with it
      ((root.PMCNet && root.PMCNet.savedBattles && root.PMCNet.savedBattles()) || []).forEach(function (b) {
        if (b.campaign && b.campLid === id) {
          if (root.PMC_BATTLE_ID && root.PMC_BATTLE_ID() === b.id && root.PMC_DISCARD_CAMPAIGN_BATTLE) root.PMC_DISCARD_CAMPAIGN_BATTLE();
          root.PMCNet.forgetBattle(b.id);
        }
      });
      if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.drop) root.PMC_CAMPAIGN.drop(id);
    }
    paint();
  }

  /* A new game while a battle is still on: the one on the table is kept in this
     browser, and waits in the Continue list. One on a game server is not left that
     way: it is said, and nothing starts. */
  function freshOk() {
    var live = root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE(), n = el('menu-note');
    if (!live || !abandonable()) return true;
    if (n) { n.textContent = 'A battle is still being fought online. Go back to it from the first card and see it through, or abandon it there, before starting another.'; n.hidden = false; }
    return false;
  }
  function discardable() { return !!(root.PMC_BATTLE_DISCARDABLE && root.PMC_BATTLE_DISCARDABLE()); }
  function abandonable() { return !!(root.PMC_BATTLE_ABANDONABLE && root.PMC_BATTLE_ABANDONABLE()); }
  // the x back to an x, and the card back to saying the battle is on
  function unconfirm() {
    var dis = el('btn-discard'), res = el('btn-resume'), sub = el('menu-resume-sub');
    if (!dis) return;
    dis.classList.remove('confirm'); dis.textContent = '\u2715';
    var what = abandonable() ? 'Abandon this battle' : 'Discard this battle';
    dis.setAttribute('aria-label', what); dis.title = what;
    if (res) res.classList.remove('discarding');
    if (sub) sub.textContent = 'The battle is still on';
  }
  function wire() {
    var m = el('menu');
    if (!m) return;
    m.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null;
      if (!b) return;
      if (root.SFX && root.SFX.click) { try { root.SFX.click(); } catch (e) { } }
      var go = b.getAttribute('data-menu');
      if (go) { delAsked = null; show(go); return; }
      var ck = b.getAttribute('data-cont');
      if (ck) { delAsked = null; pick(ck); return; }
      var cd = b.getAttribute('data-contdel');
      if (cd) {
        if (delAsked !== cd) { delAsked = cd; drawList(); return; }
        delAsked = null; drop(cd); return;
      }
      if (at === 'continue' && delAsked) { delAsked = null; drawList(); }
      var kind = b.getAttribute('data-skirmish');
      if (kind && !freshOk()) return;
      if (kind) { close(); if (root.PMC_SKIRMISH) root.PMC_SKIRMISH(kind); return; }
      /* a new campaign, solo or hotseat: the dossier takes it from here (dossier.js);
         the ones under way are in the Continue list */
      var cm = b.getAttribute('data-camp');
      if (cm) { if (root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.fresh) root.PMC_CAMPAIGN.fresh(cm); else close(); return; }
      if (b.id !== 'btn-discard') unconfirm();
      switch (b.id) {
        // a game over the network: the lobby, which asks what kind when one is started (lobby.js)
        case 'btn-multi':
          if (b.disabled || !root.PMCLobby) return;
          if (el('setup')) el('setup').hidden = true;
          close();
          root.PMCLobby.open();
          return;
        case 'btn-resume': close(); return;
        case 'btn-discard':
          var net = abandonable();
          if (!b.classList.contains('confirm')) {
            b.classList.add('confirm'); b.textContent = net ? 'Abandon?' : 'Discard?';
            b.setAttribute('aria-label', (net ? 'Abandon' : 'Discard') + ' this battle: tap again to confirm');
            el('btn-resume').classList.add('discarding');
            el('menu-resume-sub').textContent = net
              ? 'Tap Abandon? to walk away — the battle ends for your opponent too'
              : 'Tap Discard? to end it — it cannot be undone';
            return;
          }
          if (net) { if (root.PMCLobby && root.PMCLobby.abandon) root.PMCLobby.abandon(); }
          else if (root.PMC_DISCARD_BATTLE) root.PMC_DISCARD_BATTLE();
          paint();
          return;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') {
        if (UP[at]) show(UP[at]);
        else if (root.PMC_BATTLE_LIVE && root.PMC_BATTLE_LIVE()) close();
      }
    });
    root.addEventListener('resize', function () { Table.fit(); if (isOpen()) Table.start(); });
  }

  /* ================= the table behind the menu ================= */
  var Table = (function () {
    var cv = null, g = null;
    var shown = null, prev = null;   // the table on screen, and the one it is fading from
    var fadeAt = 0, running = false, raf = 0, timer = 0;
    var world = Math.floor(Math.random() * WORLDS.length);   // where the cycle starts
    var z = 1, ox = 0, oy = 0;       // how the table sits on the canvas, for the aircraft
    var pass = null, passTimer = 0;  // a pair of interceptors on the way over

    function fit() {
      if (!cv) return false;
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; return true; }
      return false;
    }

    // what a hill lifts a prop by — the board's own reading (game.js liftOf)
    function lifter(terrain) {
      return function (x, y) {
        for (var i = 0; i < terrain.length; i++) {
          var r = terrain[i];
          if (r.kind === 'hill' && R.inRect(x, y, r)) return r.top && R.inPoly(x, y, r.top) ? ISO.ELEV * 2 : ISO.ELEV;
        }
        return 0;
      };
    }

    /* A freshly rolled table on the next world in the cycle, ground and all,
       handed to `done` when it is ready. It is baked a slice at a time, each in
       a task of its own, so the menu keeps answering while the next table is
       made (a whole table in one go held the page for a second or more). */
    function bake(done) {
      var planet = WORLDS[world++ % WORLDS.length];
      var seed = (Math.random() * 100000) | 0;
      var terrain = GEN.generate({ width: R.BOARD.w, height: R.BOARD.h, planet: planet }).terrain;
      var sn = seen();
      // only the middle of the table is ever on screen behind the menu: that is all that is baked
      ISO.bakeGroundSliced(terrain, seed, planet, sn, function (ground) {
        var props = ISO.buildProps(terrain, [], seed, planet), lift = lifter(terrain);
        var s = document.createElement('canvas');
        s.width = ISO.PIXW; s.height = ISO.PIXH;
        var sg = s.getContext('2d'), i = 0;
        // the buildings and the trees, a few tens of milliseconds' worth a task
        (function more() {
          var t0 = root.performance.now();
          while (i < props.length && root.performance.now() - t0 < 30) { ISO.drawProp(sg, props[i], lift(props[i].x, props[i].y)); i++; }
          if (i < props.length) { setTimeout(more, 0); return; }
          setTimeout(function () {
            var p = document.createElement('canvas');
            p.width = Math.round(ISO.PIXW * SCALE); p.height = Math.round(ISO.PIXH * SCALE);
            var pg = p.getContext('2d');
            pg.drawImage(ground, 0, 0, p.width, p.height);
            pg.drawImage(s, 0, 0, p.width, p.height);
            p.seenW = sn ? sn.w : 0; p.seenH = sn ? sn.h : 0;
            done(p);
          }, 0);
        })();
      });
    }

    /* The part of the plate lay() will put on this screen, with a margin for a
       window made a little bigger: the menu's table is zoomed in well past the
       whole table, so most of it is never seen. A screen grown by more than the
       margin gets the whole of the next table. */
    var grown = false;
    function seen() {
      if (!cv || !cv.width || grown) return null;
      var pw = ISO.PIXW * SCALE, ph = ISO.PIXH * SCALE, W = cv.width, H = cv.height;
      var dw = (ISO.W + ISO.H) * ISO.K * SCALE, dh = dw / 2, top = ISO.TOP * SCALE;
      var zz = Math.min(Math.max(W / pw, H / ph) * 1.7, (W / dw + H / dh) * 1.02);
      var x0 = (W - pw * zz) / 2, y0 = H / 2 - (top + dh / 2) * zz;
      var mx = W * 0.2 / zz, my = H * 0.2 / zz;          // a fifth of the screen spare each side
      return { x0: (-x0 / zz - mx) / SCALE, x1: ((W - x0) / zz + mx) / SCALE,
        y0: (-y0 / zz - my) / SCALE, y1: ((H - y0) / zz + my) / SCALE, w: W, h: H };
    }

    // one table, scaled to cover the screen
    function lay(p, alpha) {
      if (!p || alpha <= 0) return;
      var W = cv.width, H = cv.height;
      /* In close, so the table fills the screen. On a wide screen that is its
         longer side and then some; a tall phone, zoomed that way, came out
         twice as close as a desktop, so it takes instead the furthest out that
         still has the screen inside the table's diamond, corners and all. */
      var fw = W / p.width, fh = H / p.height;
      var dw = (ISO.W + ISO.H) * ISO.K * SCALE, dh = dw / 2, top = ISO.TOP * SCALE;   // the table's diamond, in the picture
      z = Math.min(Math.max(fw, fh) * 1.7, (W / dw + H / dh) * 1.02);
      ox = (W - p.width * z) / 2; oy = H / 2 - (top + dh / 2) * z;   // the diamond centred, not the picture
      g.globalAlpha = alpha;
      g.drawImage(p, ox, oy, p.width * z, p.height * z);
      g.globalAlpha = 1;
    }

    function paint(now) {
      raf = 0;
      if (!running) return;
      fit();
      // a window grown past what was baked: the next table is baked whole
      if (shown && shown.seenW && (cv.width > shown.seenW * 1.3 || cv.height > shown.seenH * 1.3)) grown = true;
      var k = Math.min(1, ((now || 0) - fadeAt) / FADE);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      lay(prev, 1 - k);
      lay(shown, k);
      var flying = fly(now || 0);
      // frames only while something moves; a still table needs none
      if (k < 1 || flying) raf = root.requestAnimationFrame(paint);
      if (k >= 1) prev = null;
    }

    /* ---- the flypast ----
       Two interceptors, leader and wingman, drawn by the game's own machine
       art, crossing the table on a heading picked at random. They fly in the
       table's own coordinates, so they sit on it at the table's scale. */
    function jet(x, y, facing) {
      var p = R.profile('interceptor');
      return Object.assign({}, p, {
        id: 'M' + x, side: 'A', label: p.name, models: 1, rules: p.rules.slice(),
        sp: 0, alive: true, damage: 0, cargo: [], x: x, y: y, facing: facing
      });
    }
    function flyby() {
      passTimer = 0;
      if (!running || !R.profile('interceptor')) return;
      var ang = Math.random() * Math.PI * 2;
      var c = { x: R.BOARD.w / 2 + (Math.random() - 0.5) * 16, y: R.BOARD.h / 2 + (Math.random() - 0.5) * 16 };
      pass = { ang: ang, c: c, reach: reachFor(ang), at: root.performance && root.performance.now ? root.performance.now() : Date.now() };
      if (!raf) raf = root.requestAnimationFrame(paint);
    }
    /* How far out the pair starts and finishes, in inches: far enough that on
       this heading, at whatever the table is zoomed to, both are off the screen
       at each end. An inch along the heading moves the craft this far across
       the screen, and the flight only has to clear one of the two axes. */
    function reachFor(ang) {
      var s = ISO.K * SCALE * z;
      var ex = Math.abs((Math.cos(ang) - Math.sin(ang)) * s);
      var ey = Math.abs((Math.cos(ang) + Math.sin(ang)) * s / 2);
      var rx = ex > 0.01 ? (cv.width / 2 + 160) / ex : Infinity;
      var ry = ey > 0.01 ? (cv.height / 2 + 160) / ey : Infinity;
      // plus the slack for wherever the pass was centred, and the wingman behind
      return Math.max(20, Math.min(400, Math.min(rx, ry) + 14));
    }
    function fly(now) {
      if (!pass || !ISO.drawUnit) return false;
      var k = (now - pass.at) / PASS;
      if (k > 1) { pass = null; return false; }
      var dx = Math.cos(pass.ang), dy = Math.sin(pass.ang), reach = pass.reach || 46;
      var lead = { x: pass.c.x + dx * reach * (2 * k - 1), y: pass.c.y + dy * reach * (2 * k - 1) };
      g.save();
      g.setTransform(z * SCALE, 0, 0, z * SCALE, ox, oy);
      [[-3, 3], [0, 0]].forEach(function (o) {          // the wingman first: it is behind
        var x = lead.x + dx * o[0] - dy * o[1], y = lead.y + dy * o[0] + dx * o[1];
        try { ISO.drawUnit(g, jet(x, y, pass.ang), { at: { x: x, y: y }, status: 'ready' }); } catch (e) { pass = null; }
      });
      g.restore();
      return !!pass;
    }

    /* Roll the next table and fade it in over the last, then do it again. The
       bake waits a tick, so the menu is up and answering before the first. */
    var baking = false;
    function next() {
      timer = 0;
      if (!running || baking) return;
      baking = true;
      try { bake(laid); }
      catch (e) { baking = false; if (root.console) console.warn('the menu table could not be drawn', e); }
    }
    function laid(p) {
      baking = false;
      if (!running) return;
      prev = shown; shown = p;
      // the pass goes over the table it was started with: a table that changed
      // half way through would leave the pair flying over the next one
      if (Math.random() < FLYBY) flyby();
      fadeAt = root.performance && root.performance.now ? root.performance.now() : Date.now();
      if (!raf) raf = root.requestAnimationFrame(paint);
      timer = setTimeout(next, EVERY);
    }

    /* The table runs behind the menu, or behind whatever other screen hands it a
       canvas of its own (a new battle's set-up, on a desktop). One at a time:
       starting it on another canvas moves it there, the last table coming along. */
    function start(target) {
      var want = target || el('menu-table');
      if (running && want === cv) return;
      if (running) stop();
      if (root.PMC_NO_BACKDROP) return;
      if (want !== cv) { cv = want; g = null; }
      if (!cv || !cv.getContext || !root.requestAnimationFrame || !ISO || !GEN || !R) return;
      // a canvas that is not on screen has nothing to show a table on
      if (!(cv.clientWidth > 0 && cv.clientHeight > 0)) return;
      g = g || cv.getContext('2d');
      if (!g) return;
      running = true;
      if (shown) { fadeAt = -FADE; raf = root.requestAnimationFrame(paint); }   // the last one, at once
      timer = setTimeout(next, shown ? EVERY : 30);
    }
    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = 0; }
      if (passTimer) { clearTimeout(passTimer); passTimer = 0; }
      pass = null;
      if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
      raf = 0;
    }
    function resized() { if (running && fit() && !raf) raf = root.requestAnimationFrame(paint); }
    return { start: start, stop: stop, fit: resized, flyby: function () { if (running) flyby(); },
      on: function () { return running ? cv : null; } };
  })();

  root.PMCMenu = { open: open, close: close, isOpen: isOpen, show: show, paint: paint, table: Table,
    // the tests' view of the Continue list
    games: games, refresh: function () { fetchRemote(true); } };

  function boot() {
    wire();
    if (isOpen()) { paint(); Table.start(); }
    /* The campaign is read from storage after the page loads; say "Continue"
       as soon as it is there. */
    setTimeout(paint, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : global);
