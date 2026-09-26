/* PMC 2670 — Firefight : what happened, played out. The engine hands the
   battle back already resolved, with the events that got it there; this draws
   them one at a time — each move, shot and assault in turn, the next only once
   the last has been drawn — and holds back what the table shows of each unit
   until its part has played.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCReplay = function (B) {
    var busy = B.busy, byId = B.byId, logLine = B.logLine, menuUp = B.menuUp, newTable = B.newTable;
    var nowMs = B.nowMs, send = B.send, startLoop = B.startLoop, whenIdle = B.whenIdle, C = B.C, FX = B.FX;
    var ISO = B.ISO, R = B.R, SFX = B.SFX, anims = B.anims, el = B.el, resQueue = B.resQueue, ui = B.ui;
    // from modules installed after this one: looked up when called
    function addFx() { return B.addFx.apply(this, arguments); }
    function animateMove() { return B.animateMove.apply(this, arguments); }
    function boardAnim() { return B.boardAnim.apply(this, arguments); }
    function drawPanel() { return B.drawPanel.apply(this, arguments); }
    function drawStats() { return B.drawStats.apply(this, arguments); }
    function feedHosts() { return B.feedHosts.apply(this, arguments); }
    function fitView() { return B.fitView.apply(this, arguments); }
    function focusUnit() { return B.focusUnit.apply(this, arguments); }
    function handsOff() { return B.handsOff.apply(this, arguments); }
    function landUnit() { return B.landUnit.apply(this, arguments); }
    function lookAtDeployment() { return B.lookAtDeployment.apply(this, arguments); }
    function paintStructures() { return B.paintStructures.apply(this, arguments); }
    function playAssault() { return B.playAssault.apply(this, arguments); }
    function playShooting() { return B.playShooting.apply(this, arguments); }
    function playStrafe() { return B.playStrafe.apply(this, arguments); }
    function pushRes() { return B.pushRes.apply(this, arguments); }
    function queueBake() { return B.queueBake.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }
    function repaintTerrain() { return B.repaintTerrain.apply(this, arguments); }
    function scheduleReturn() { return B.scheduleReturn.apply(this, arguments); }
    function setHint() { return B.setHint.apply(this, arguments); }
    function setMTab() { return B.setMTab.apply(this, arguments); }
    function sideInk() { return B.sideInk.apply(this, arguments); }
    function stepOff() { return B.stepOff.apply(this, arguments); }
    function walkOn() { return B.walkOn.apply(this, arguments); }

    /* ---- replaying what happened ----
       One event at a time, waiting for the animation each one starts before the
       next goes in. That is the pacing the game has always had: the shot is
       drawn, and only when it lands does the card come up. */
    // a new battle, or none: nothing of the last one's show is left to draw
    function resetShow() {
      if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
      show.queue.length = 0;
      show.waiting = false; show.gen++;
      slideAfter = {};
      pendingArrive = {};
      clearHeld();
      if (B.state) B.state.units.forEach(function (u) { u.ax = u.ay = null; });   // nothing is part-way through a move now
      anims.forEach(function (an) { if (an.unit) an.unit.burrow = null; });
      anims.length = 0;
      FX.clear && FX.clear();
      resQueue.length = 0; ui.resOpen = false;
      var box = el('resolution'); if (box) box.hidden = true;
      clearTimeout(ui.resTimer);
      feedHosts().forEach(function (h) { h.innerHTML = ''; });
      ui.feedUnread = 0;
      ui.selected = null; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = [];
      ui.insertion = null; ui.preview = null; ui.deployPick = null;
      ui.watch = null; ui.inspect = false;
    }

    /* A unit whose arrival is still waiting in the queue is already on the
       table in the state that came with it — but it is not drawn until the
       arrival plays, so an AI's Battlefield Insertion does not sit there through
       the beat before its drop. Kept by id: a networked state is rebuilt each turn. */
    var pendingArrive = {};
    function moveQueued(u) {
      return !!u && show.queue.some(function (ev) { return ev.e === 'move' && ev.id === u.id; });
    }
    function arrivalQueued(u) { return !!(u && pendingArrive[u.id]); }
    /* The battle arrives already resolved, and what happened is played out after
       it. Until each part plays, the table should show things as they stood: a
       unit that is about to move stands where it started, and a unit about to be
       shot keeps the models, the suppression and the life it had until the shots
       land. `shown` is the table as it was last drawn at rest; `held` is what is
       kept back from the new state until its event plays. */
    var shown = {}, held = {};
    // `held` is one object for the battle: the drawing reads it, so it is emptied, never replaced
    function clearHeld() { Object.keys(held).forEach(function (k) { delete held[k]; }); }
    function snapshotShown() {
      shown = {};
      if (!B.state) return;
      B.state.units.forEach(function (u) {
        shown[u.id] = { models: u.models, sp: u.sp, alive: u.alive, x: u.x, y: u.y, aboard: u.aboard, reserve: u.reserve, damage: u.damage, fled: u.fled };
      });
    }
    /* Where a unit was pushed without a move of its own to play — an assault's
       loser falling back 2", a garrison put out of its building — it stays on
       the spot it was hit on until the attack that did it has been drawn, then
       goes to where the rules have put it. Kept by id, like `held`. */
    var slideAfter = {};
    function holdForShow(events) {
      if (!B.state) return;
      var walks = {};
      events.forEach(function (ev) { if (ev.e === 'move' && ev.id) walks[ev.id] = true; });
      var moved = {};
      events.forEach(function (ev) {
        if (ev.e === 'move' && ev.id && !moved[ev.id]) {
          moved[ev.id] = true;
          var mu = evUnit(ev.id), p0 = ev.path && ev.path[0];
          // it stands where it started until its move is drawn
          if (mu && p0 && (mu.ax === null || mu.ax === undefined) && !anims.some(function (an) { return an.unit === mu; })) {
            mu.ax = p0.x; mu.ay = p0.y;
          }
        }
        var hit = [];
        if (ev.e === 'shoot' || ev.e === 'assault') hit.push(ev.to, ev.from);
        (ev.deaths || []).forEach(function (d) { hit.push(d.id); });
        hit.forEach(function (id) {
          if (!id || !shown[id]) return;
          var was0 = shown[id], u0 = evUnit(id);
          // shot at here, whatever the rules have done with it since: the rounds fly to where it stood
          if (u0 && !walks[id] && !slideAfter[id] && was0.x >= 0 && (u0.ax === null || u0.ax === undefined) &&
              (Math.abs(u0.x - was0.x) > 0.01 || Math.abs(u0.y - was0.y) > 0.01)) {
            u0.ax = was0.x; u0.ay = was0.y; slideAfter[id] = true;
          }
          if (held[id]) return;
          var was = shown[id], u = evUnit(id);
          if (!u || !was.alive) return;
          if (was.models !== u.models || was.sp !== u.sp || was.alive !== u.alive || was.damage !== u.damage) held[id] = was;
        });
      });
    }
    function releaseFor(ev) {
      if (!ev) return;
      [ev.to, ev.from, ev.id].concat((ev.deaths || []).map(function (d) { return d.id; }))
        .forEach(function (id) {
          if (!id) return;
          delete held[id];
          if (!slideAfter[id]) return;
          delete slideAfter[id];
          var u = evUnit(id);
          if (!u) return;
          var from = { x: u.ax, y: u.ay };
          u.ax = null; u.ay = null;
          // off to where it now stands, if it still stands anywhere on the table
          if (u.alive && u.x >= 0 && from.x != null) animateMove(u, [from, { x: u.x, y: u.y }]);
        });
    }
    // the unit as it should be drawn: itself, or itself as it stood before what is still to be played
    function shownAs(u) {
      var h = u && held[u.id];
      if (!h) return u;
      var o = Object.create(u);
      o.models = h.models; o.sp = h.sp; o.alive = h.alive; o.damage = h.damage; o.fled = h.fled;
      if (!u.alive) { o.x = h.x; o.y = h.y; o.aboard = h.aboard; o.reserve = h.reserve; }
      return o;
    }
    var show = {
      queue: [],
      running: false,
      waiting: false,           // an event that takes time is being drawn
      gen: 0,                   // which battle's show this is (resetShow moves it on)
      play: function (events) {
        (events || []).forEach(function (ev) { if (ev.e === 'arrive' && ev.id && ev.how !== 'board') pendingArrive[ev.id] = true; });
        holdForShow(events || []);
        this.queue = this.queue.concat(events || []);
        this.pump();
      },
      pump: function () {
        while (show.queue.length) {
          var ev = show.queue[0];
          var waits = SHOWN[ev.e] === 'wait';
          if (waits && busy()) { whenIdle(show.pump); return; }
          /* The other side's next activation waits for this one to be finished
             with: its cards read and put away, not just its shots drawn. Closing
             the last card pumps again (closeRes). */
          if (ev.e === 'focus' && (ui.resOpen || resQueue.length) && otherSides(ev.id)) return;
          show.queue.shift();
          if (!waits) {
            try { applyEvent(ev); }
            catch (e) { if (window.console) console.error('replaying ' + ev.e, e); }
            continue;
          }
          /* An event that takes time says when it is done: the move drawn to its
             end, the last round landed. Only then — and once the table has
             settled — does the next come on. Nothing is inferred from whether the
             table happens to be moving at the instant it was started. A backstop
             keeps a callback that never comes from stalling the battle. */
          show.waiting = true;
          (function (ev, gen) {
            var settled = false, guard = setTimeout(fin, 12000);
            function fin() {
              if (settled) return;
              settled = true; clearTimeout(guard);
              whenIdle(function () {
                if (gen !== show.gen) return;          // a new battle since: this one's show is over
                show.waiting = false;
                // what it did to them shows on the panels once it has been drawn, not before
                releaseFor(ev); drawStats(); drawPanel(); show.pump();
              });
            }
            var took = false;
            try { took = applyEvent(ev, fin); }
            catch (e) { if (window.console) console.error('replaying ' + ev.e, e); }
            if (!took) fin();
          })(ev, show.gen);
          return;
        }
        clearHeld();
        // anything still waiting to go where the rules put it goes now
        Object.keys(slideAfter).forEach(function (id) { var u = evUnit(id); if (u) { u.ax = null; u.ay = null; } });
        slideAfter = {};
        snapshotShown();
        show.running = false;
        syncUI();
        render();
        stepWatched();
        scheduleReturn();
      }
    };
    // is anything that has already happened still to be drawn, or being drawn?
    function replaying() { return show.queue.length > 0 || show.waiting; }
    // is this event's unit the other side's — not one this screen plays?
    function otherSides(id) {
      var u = evUnit(id);
      return !!u && B.seats.indexOf(u.side) < 0;
    }
    // which events start something that takes time, and which land at once
    var SHOWN = {
      move: 'wait', shoot: 'wait', assault: 'wait', strafe: 'wait', arrive: 'wait',
      // the camera settling on the other side's unit is itself worth a moment
      focus: 'wait'
    };
    /* A beat before the other side acts. Their whole turn arrives at once and
       would otherwise start drawing the instant the player's own shot finished,
       which reads as the opponent interrupting rather than answering. */
    var OPPONENT_BEAT = 1400;             // long enough to see which unit is about to act
    function beat(ms) {
      anims.push({ kind: 'beat', dur: ms, t0: nowMs() });
      startLoop();
    }

    /* A battle nobody is playing — a demo, both sides on the behaviour table —
       is walked forward one activation at a time: the engine resolves one, this
       draws it, and only then is the next asked for. Otherwise the whole battle
       would resolve before a single shot was drawn. */
    var stepTimer = null;
    function stepWatched() {
      if (stepTimer || !B.net || !B.state || B.state.over) return;
      if (!B.state.cfg || B.state.cfg.aiSides.length !== 2) return;
      if (B.state.phase !== 'battle' || ui.resOpen || menuUp()) return;
      stepTimer = setTimeout(function () {
        stepTimer = null;
        if (!B.state || B.state.over || ui.resOpen || menuUp()) return;
        send({ k: 'step' });
      }, 260);
    }

    function evUnit(id) { return id ? B.Q.byId(id) : null; }

    /* Play one event. One that takes time is handed `done` and returns true if it
       will call it when it has been drawn; false leaves the replay to wait on the
       table settling. */
    function applyEvent(ev, done) {
      // a test can ask for the order the show is played in, and when
      if (window.__traceShow) window.__traceShow.push({ t: Math.round(nowMs()), e: ev.e, id: ev.id || ev.from || (ev.f && ev.f.kind) || (ev.card && ev.card.kind) || '', to: ev.to || '', busy: busy() });
      switch (ev.e) {
        case 'log': logLine(ev.t, ev.text, ev.math); return;
        case 'card': pushRes(ev.card); return;
        case 'fx': addFx(reLift(ev.f)); return;
        case 'sound': {
          // a sound the rules asked for, by name; 'suppressed' is an older word for it
          if (!SFX) return;
          var sn = ev.what === 'suppressed' ? 'suppress' : ev.what;
          if (typeof SFX[sn] === 'function') SFX[sn].apply(SFX, ev.args || []);
          return;
        }
        case 'move': {
          var mu = evUnit(ev.id);
          if (!mu) return false;
          animateMove(mu, ev.path, ev.follow, done);
          return !!done;
        }
        case 'shoot': {
          var sa = evUnit(ev.from), sb = ev.at ? { x: ev.at.x, y: ev.at.y } : evUnit(ev.to);
          if (!(sa && sb)) return false;
          playShooting(sa, sb, ev.res || { hits: 0 }, deathsOf(ev.deaths), done || null);
          return !!done;
        }
        case 'assault': {
          var aa = evUnit(ev.from), ab = evUnit(ev.to);
          if (!(aa && ab)) return false;
          playAssault(aa, ab, deathsOf(ev.deaths), done || null);
          return !!done;
        }
        case 'strafe': {
          var su = evUnit(ev.id);
          if (!su) return false;
          playStrafe(su, ev.from, ev.to, deathsOf(ev.deaths), done || null);
          return !!done;
        }
        case 'arrive': {
          delete pendingArrive[ev.id];
          var au = evUnit(ev.id);
          if (!au) return;
          if (ev.how === 'drop') landUnit(au);
          else if (ev.how === 'orbital') landUnit(au, true);
          else if (ev.how === 'stepoff') stepOff(au, evUnit(ev.veh));
          else if (ev.how === 'board') boardAnim(au, evUnit(ev.veh) || au, ev.from);
          else walkOn(au, ev.from);
          return;
        }
        case 'focus': {
          var fu = evUnit(ev.id);
          if (!fu) return;
          // the other side's unit borrows the camera; it is handed back once they are done. (Whose
          // turn it is by the state would be wrong here: by the time this is drawn it is already ours.)
          focusUnit(fu, false, B.seats.indexOf(fu.side) < 0);
          // a pause before the other side's unit acts — and before every unit in a demo, where both sides are the AI's
          if (B.seats.indexOf(fu.side) < 0 || handsOff()) beat(OPPONENT_BEAT);
          return;
        }
        case 'hint': setHint(null, ev.text || undefined); return;
        case 'colour': {
          ISO.setSideColour(ev.side, ev.key);
          // the panels, pills and P1/P2 tags wear the colours the forces are painted in
          var cvar = { A: '--own-A', C: '--own-C' }[ev.side];
          if (cvar && ISO.PALETTE[ev.side]) document.documentElement.style.setProperty(cvar, sideInk(ev.side));
          return;
        }
        case 'terrain': {
          var pieces = (ev.pieces || []).map(function (i) { return { piece: B.state.terrain[i] }; })
            .filter(function (w) { return !!w.piece; });
          repaintTerrain(pieces);
          return;
        }
        case 'newtable': newTable(ev.whole); return;
        case 'scenery': queueBake(); return;
        case 'fit': fitView(); return;
        case 'structures': if (B.state.structs) paintStructures(); return;
        case 'clearcards': {
          /* Clear the table's cards and effects, but not the rest of the batch
             this came in: the new game's table, its zoom and its first look are
             queued right behind it. */
          var rest = show.queue.slice();
          resetShow();
          Array.prototype.push.apply(show.queue, rest);
          return;
        }
        case 'look': lookAtDeployment(ev.side); return;
        default: return;
      }
    }

    /* An effect the engine described without knowing how high anything is drawn.
       A flier's height is a matter for the view, so it is filled in here. */
    function reLift(f) {
      /* A teleport link to or from a craft meets the craft's middle, and the
         craft's gate runs for as long as the link is up. */
      if (f && f.kind === 'tplink') {
        [['fromId', 'from'], ['toId', 'to']].forEach(function (e) {
          var cu = evUnit(f[e[0]]);
          if (cu && cu.cls === 'aircraft') {
            f[e[1]] = { x: f[e[1]].x, y: f[e[1]].y, up: ISO.craftCentreUp(cu) };
            cu.ringUntil = nowMs() + (f.delay || 0) + (f.dur || 1500);
          }
        });
        return f;
      }
      /* A smoke round fired by a machine — a captured patrol craft's — leaves its
         gun, up where the craft flies, not the grass under it. */
      if (f && f.kind === 'lob' && f.unit) {
        var sm = evUnit(f.unit);
        if (sm && R.isMachine(sm)) f.from = ISO.mountFor(ISO.mounts(sm), R.weaponSpec(sm).p, sm, f.from);
        return f;
      }
      /* A marker's laser and a Keen-Eyed glint come off the machine's own
         sensor, however high it flies: the nose of a craft, its scanner. */
      if (f && f.unit && (f.kind === 'beam' || f.kind === 'glint')) {
        var src = evUnit(f.unit);
        if (src && !R.isMachine(src)) {
          // a squad's laser and glint come off the eyes of the man with the optics — the spotter, the observer
          var sq = ISO.muzzles(src, R.status(src)).filter(function (m) { return m.eye; })[0];
          if (sq) f.mz = sq.eye;
        } else if (src && (src.cls === 'aircraft' || src.cls === 'vehicle')) {
          var M = ISO.mounts(src), at = f.kind === 'beam' ? (M.nose || M.scan) : (M.scan || M.nose);
          if (at && at.length) f.mz = at[0];
          else if (ISO.flyLift(src)) f.mz = { dx: 0, dy: -ISO.flyLift(src) };
        }
        return f;
      }
      if (!f || f.up !== 0 || !f.unit) return f;
      var u = evUnit(f.unit);
      if (u) f.up = ISO.flyLift(u);
      return f;
    }
    function deathsOf(list) {
      return (list || []).map(function (d) {
        var u = evUnit(d.id);
        return u ? { u: u, x: d.x, y: d.y } : null;
      }).filter(Boolean);
    }

    /* The selection, the shaded ground and the prompts all belong to the battle
       rather than to either screen, so they arrive with it. */
    function syncUI() {
      if (!B.state) return;
      var s = B.mirror.sel();
      ui.mode = s.mode;
      ui.selected = s.selected;
      ui.targets = s.targets;
      ui.moves = s.moves;
      ui.terrain = s.terrain;
      ui.markKind = s.markKind;
      ui.markPicks = s.markPicks;
      ui.digDir = s.digDir == null ? null : s.digDir;     // Dig in!: the facing on offer
      ui.deployPick = s.deployPick;
      var wasAsked = !!ui.insertion || !!ui.reservePick;
      ui.reservePick = s.reservePick || null;
      ui.insertion = s.insertion;
      // a drop point being asked for: on a phone the Actions pane, where the ask is, comes to the front
      if ((ui.insertion || ui.reservePick) && !wasAsked && window.innerWidth <= 1000) setMTab('act');
      ui.sections = s.sections || [];
      ui.tsetHint = s.tsetHint || '';
      ui.vis = null; ui.visKey = '';
      ui.preview = null;
      /* In a demo the watcher's pick is the selection, and it stays picked
         while the AI activates one unit after another — until it is gone. */
      if ((handsOff() || ui.inspect) && ui.watch) {
        var w = byId(ui.watch);
        if (w && w.alive) { ui.selected = w; ui.mode = 'idle'; ui.targets = []; ui.moves = []; ui.terrain = []; ui.sections = []; }
        else { ui.watch = null; ui.inspect = false; }
      }
    }

    return {
      arrivalQueued: arrivalQueued,
      held: held,
      moveQueued: moveQueued,
      replaying: replaying,
      resetShow: resetShow,
      show: show,
      shownAs: shownAs,
      stepWatched: stepWatched
    };
  };
})(window);
