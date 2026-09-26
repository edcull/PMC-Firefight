/* PMC 2670 — Firefight : arrivals: units coming down from orbit or walking on, the insertion and reinforcement cards, and the answers owed between turns.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCArrive = function (B) {
    var addFx = B.addFx, animateMove = B.animateMove, arrivalWhere = B.arrivalWhere, byId = B.byId;
    var nowMs = B.nowMs, sfName = B.sfName, sideName = B.sideName, soloOwnerName = B.soloOwnerName, H = B.H;
    var ISO = B.ISO, R = B.R, SFX = B.SFX, W = B.W, cam = B.cam, ui = B.ui;
    // from modules installed after this one: looked up when called
    function esc() { return B.esc.apply(this, arguments); }
    function escHtml() { return B.escHtml.apply(this, arguments); }
    function focusUnit() { return B.focusUnit.apply(this, arguments); }
    function render() { return B.render.apply(this, arguments); }

    /* ================= coming down ==================
       A Battlefield Insertion is not a unit blinking into existence. A craft drops
       out of the sky onto its landing point and throws up the dust it lands in; a
       squad is already on the ground when you see it, and comes up out of cover —
       which the game already has a way of drawing, because a unit flat on its face
       is a broken one. So an arriving squad is drawn broken, then suppressed, then
       standing, over about a second. It is only how it is drawn: the unit's real
       status, and everything the rules ask of it, is untouched. */
    var MOTION = window.PMCMotion;   // the timings and shapes of movement, shared with the Unit Viewer (motion.js)
    var DROP_MS = MOTION.DROP_MS, STAND_MS = MOTION.STAND_MS, TELE_MS = MOTION.TELE_MS;
    // how an arriving unit is drawn now (motion.js: arrival); once it is over, it is done arriving
    function arriving(u) {
      if (!u || !u.arriveAt) return { lift: 0, pose: null };
      var a = MOTION.arrival(u.arriveKind, nowMs() - u.arriveAt, R.isMachine(u), u.dropFrom);
      if (!a) { u.arriveAt = 0; u.dropFrom = null; return { lift: 0, pose: null }; }
      return a;
    }
    function anyArriving() {
      /* An arrival ends by the clock, drawn or not: a unit that came up off screen
         used to hold the whole game waiting for a frame that never drew it. */
      return B.state && B.state.units.some(function (u) {
        if (!u.arriveAt) return false;
        if (nowMs() - u.arriveAt >= MOTION.arrivalMs(u.arriveKind)) { u.arriveAt = 0; u.dropFrom = null; return false; }
        return true;
      });
    }

    /* Troops stepping off a hull are not set down on the ground fully formed
       either — least of all out of a drop platform that has just come in hard. A
       disembarking squad comes up the same way an inserted one does, a beat
       quicker, because it only has to get clear of the ramp. */
    function stepOff(u, veh) {
      if (!u || !u.alive || R.isMachine(u)) return;
      var from = veh ? { x: veh.x, y: veh.y } : null;
      if (veh && veh.cls === 'aircraft') {
        /* Out of an aircraft the squad comes down from the airframe itself: from
           the craft's own height, sliding out from under it to where it lands. */
        u.arriveAt = nowMs();
        u.arriveKind = 'drop';
        u.dropFrom = ISO.flyLift(veh) || ISO.ELEV * 4;
        if (from) animateMove(u, [from, { x: u.x, y: u.y }], false);
        setTimeout(function () {
          if (!B.state || !u.alive) return;
          addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.4, dur: 480, blocking: true });
          if (SFX) { SFX.step(); SFX.step(0.12); }
        }, DROP_MS - 60);
        addFx({ kind: 'hold', x: u.x, y: u.y, dur: DROP_MS + 200, blocking: true });
        return;
      }
      // off a ground hull the squad walks out of the back of it to where it was put
      if (from) { animateMove(u, [from, { x: u.x, y: u.y }], false); return; }
      u.arriveAt = nowMs();
      u.arriveKind = 'stand';
      addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.2, dur: 480, blocking: true });
      addFx({ kind: 'hold', x: u.x, y: u.y, dur: STAND_MS, blocking: true });
    }
    /* Boarding: the squad is aboard as far as the rules go at once, but it is
       drawn walking from where it stood to the hull — or, for an aircraft, up
       into it — before it vanishes inside. */
    function boardAnim(u, veh, from) {
      if (!u || !from) return;
      var dist = R.inches(from.x, from.y, veh.x, veh.y);
      u.boarding = { a: from, b: { x: veh.x, y: veh.y }, t0: nowMs(), dur: Math.min(1100, 320 + dist * 90),
        up: veh.cls === 'aircraft' ? (ISO.flyLift(veh) || 0) : 0 };
      u.faceL = veh.x < from.x - ISO.K * 0.3 ? true : veh.x > from.x + ISO.K * 0.3 ? false : u.faceL;
      addFx({ kind: 'hold', x: veh.x, y: veh.y, dur: u.boarding.dur + 60, blocking: true });
    }

    /* A unit walking or driving on from a table edge, shown coming in from the
       nearest edge (or from `start`, where the scenario says it came out) to
       where it was put. */
    function walkOn(u, start) {
      var dl = u.x, dr = W - u.x, dt = u.y, db = H - u.y, m = Math.min(dl, dr, dt, db);
      var from = start ? { x: start.x, y: start.y } : m === dl ? { x: 0.2, y: u.y } : m === dr ? { x: W - 0.2, y: u.y }
        : m === dt ? { x: u.x, y: 0.2 } : { x: u.x, y: H - 0.2 };
      focusUnit(u, false, true);
      animateMove(u, [from, { x: u.x, y: u.y }], false);
      /* Arriving within 12" of the enemy invites a free shot (p. 30). The engine
         has already fired it and sent the result along behind this arrival. */
      render();
    }

    function teleportsIn(u) {
      var p = R.profile(u.key);
      return u.faction === 'xeno' && !u.eshAven && !(p && p.eshAven);
    }
    // the pillar is sized to what comes through it
    var teleportR = MOTION.teleportR;
    function landUnit(u, fromOrbit) {
      focusUnit(u, false, true);
      /* A hull comes down on its landing point, and so do jump troops on their
         jets. A squad landing by Battlefield Insertion is shown getting up off
         the ground it came down on — except out of orbit in an Invasion, where
         it falls out of the sky like everything else that side lands. */
      var craft = !!fromOrbit || R.isMachine(u) || !!u.jets;
      /* A swarm comes up out of the ground, whatever the scenario, giants and
         all — only what flies drops out of the sky. */
      if (u.faction === 'bugs') craft = R.isFlying(u) || R.flyInf(u);
      u.arriveAt = nowMs();
      /* The Xenotripods teleport in rather than land, hulls and craft as well as
         squads — all but the Esh-Aven, who come up out of the ground as men do. */
      if (!fromOrbit && teleportsIn(u)) {
        u.arriveKind = 'teleport';
        addFx({ kind: 'teleportin', x: u.x, y: u.y, r: teleportR(u), dur: TELE_MS + 200, blocking: true });
        if (SFX && SFX.shimmer) SFX.shimmer();
        render();
        return;
      }
      u.arriveKind = craft ? 'drop' : 'stand';
      if (craft) {
        // the dust it throws up as it touches down, and the shockwave after it
        addFx({ kind: 'dropmark', x: u.x, y: u.y, dur: DROP_MS, blocking: true });
        setTimeout(function () {
          if (!B.state || !u.alive) return;
          addFx({ kind: 'collapse', x: u.x, y: u.y, r: 2.4, dur: 700, blocking: true });
          if (SFX) { SFX.impact(); SFX.impact(0.09); }
          render();
        }, DROP_MS - 60);
      } else if (R.isMachine(u)) {
        // the ground breaking open under it, and the dust thrown up round it
        addFx({ kind: 'groundbreak', x: u.x, y: u.y, r: 2.4, dur: STAND_MS + 500, blocking: true });
        addFx({ kind: 'collapse', x: u.x, y: u.y, r: 2.8, dur: STAND_MS, blocking: true });
        if (SFX) { SFX.impact(0.05); SFX.impact(0.18); }
      } else {
        addFx({ kind: 'collapse', x: u.x, y: u.y, r: 1.6, dur: 600, blocking: true });
        // boots, then the squad on its feet
        if (SFX) { SFX.step(); SFX.step(0.24); SFX.step(0.5); }
      }
      // keep the frame loop turning while the arrival plays out
      addFx({ kind: 'hold', x: u.x, y: u.y, dur: craft ? DROP_MS + 300 : STAND_MS, blocking: true });
      render();
    }

    // a Command Unit riding in a Command Vehicle, offered its special action (p. 57)
    function cmdOfferCard() {
      var o = B.state.cmdOffer, veh = byId(o.veh), cmd = byId(o.cmd);
      if (!veh || !cmd) return '';
      var n = R.ruleValue(veh, 'Command Unit');
      return '<div class="card"><h2>Command Vehicle</h2>' +
        '<p class="sub"><b>' + esc(cmd.name) + '</b> is riding in <b>' + esc(veh.name) + '</b>. Now the vehicle has acted, it may Coordinate: ' +
        'up to ' + n + ' friendly units within 12" of the vehicle activate in a row.</p>' +
        '<div class="acts"><button class="act" data-act="cmdcoord"><span>Coordinate</span><small>' + n + ' more activations in a row</small></button>' +
        '<button class="act" data-act="cmdskip"><span>No action</span><small>Let the activation pass</small></button></div></div>';
    }
    /* Modifying the armies (p. 46): before deployment, with the enemy's list on
       the other panel, a player swaps some units for others of the same Tier. */
    function swapCard() {
      var sa = B.state.swapAsk, foeSide = sa.side === 'A' ? 'B' : 'A';
      var mine = B.state.units.filter(function (u) { return u.side === sa.side && u.pickIdx != null; });
      var theirs = B.state.units.filter(function (u) { return u.side === foeSide; });
      // a hotseat's secret round: whose turn it is, and what they have down to swap so far
      var stg = B.state.swapStage, held = {};
      sa.done.forEach(function (d) { if (d.held) held[d.outId] = d.in; });
      var h = '<div class="cmodal" data-swapbox><div class="cmodal-box wide" role="dialog" aria-modal="true" aria-label="Modify your army">' +
        '<h3>' + (stg ? esc(sideName(sa.side)) + ' — modify your army' : 'Modify your army') + '</h3>' +
        (stg ? '<p class="sub"><b>' + esc(sideName(foeSide)) + ', look away.</b> Your swaps stay secret until ' +
          (stg.order.length > 1 ? 'both of you are done' : 'you are done') + '; the other side sees your force as it was mustered.</p>' : '') +
        '<p class="sub">Swap up to <b>' + sa.total + '</b> unit' + (sa.total === 1 ? '' : 's') +
        ' for others of the same Tier' + (B.state.cfg.dossier ? ' from your dossier' : '') + ' — <b>' + sa.left + ' left</b>. ' +
        'You have seen the table and their force.</p><div class="cmodal-scroll"><div class="swapgrid">';
      // your list, the unit being swapped marked
      h += '<div class="swapcol"><h4>Your force</h4>' + mine.map(function (m) {
        var n = B.Q.swapOptions(sa.side, m.id).length, on = sa.pick === m.id;
        if (held[m.id]) return '<button class="act on" disabled><span>' + esc(m.name) + ' → ' + esc(held[m.id]) + '</span><small>Tier ' + R.ROMAN[m.tier] + ' — swapped</small></button>';
        return '<button class="act' + (on ? ' on' : '') + '" data-swappick="' + (on ? '' : m.id) + '"' + (n ? '' : ' disabled') + '><span>' + esc(m.name) +
          '</span><small>Tier ' + R.ROMAN[m.tier] + (n ? (on ? ' — swapping' : '') : ' — nothing to swap in') + '</small></button>';
      }).join('') + '</div>';
      // what could stand in for it
      h += '<div class="swapcol"><h4>' + (sa.pick ? 'Swap for' : 'Swap in') + '</h4>';
      if (sa.pick) {
        var opts = B.Q.swapOptions(sa.side, sa.pick);
        h += opts.length ? opts.map(function (o) {
          var pr = R.profile(R.splitPick(o.key).key);
          return '<button class="act" data-swapin="' + escHtml(o.id) + '"><span>' + esc(o.name) + '</span><small>' +
            esc(pr ? (pr.name !== o.name ? pr.name + ' · ' : '') + 'Move ' + pr.move + '" · FP ' + (pr.fp == null ? '—' : pr.fp) + ' · Range ' + pr.range + '" · Def ' + pr.def : '') + '</small></button>';
        }).join('') : '<p class="hint">Nothing of that Tier to swap in.</p>';
      } else h += '<p class="hint">Pick one of your units to see what could take its place.</p>';
      h += '</div>';
      // and what they are bringing, to swap against
      h += '<div class="swapcol theirs"><h4>' + esc(sideName(foeSide)) + '</h4>' + theirs.map(function (t) {
        return '<div class="swapfoe"><b>' + esc(t.name) + '</b><small>Tier ' + R.ROMAN[t.tier] + ' · ' + (t.cls === 'infantry' ? t.models + ' models' : t.cls) + '</small></div>';
      }).join('') + '</div>';
      h += '</div></div><div class="askrow"><button class="start" data-act="swapdone" data-who="' + sa.side + '">' + (sa.left === sa.total ? 'Keep the list' : 'Done') + '</button></div></div></div>';
      return h;
    }
    // placing pieces by hand: Last Stand, Fortify and Strike!, Detailed Terrain Knowledge
    function placeCard() {
      var pa = B.state.placeAsk;
      var T = { laststand: ['Last Stand', 'Put up to ' + pa.total + ' barricades (low walls) anywhere but the enemy deployment zone.'],
        fortify: ['Fortify and Strike!', 'Put up to ' + pa.total + ' field fortifications (low walls) in your deployment zone.'],
        terrain: ['Detailed Terrain Knowledge', 'Move up to ' + pa.total + ' pieces of terrain up to 12" each. Tap a piece, then where it goes.'] }[pa.why];
      var picked = pa.kind === 'move' && pa.pick != null ? B.state.terrain[pa.pick] : null;
      return '<div class="card"><h2>' + T[0] + '</h2><p class="sub">' + T[1] + '</p>' +
        '<p class="hint">' + (picked ? 'Moving the ' + esc(R.TERRAIN[picked.kind].name.toLowerCase()) + ' — tap where it goes, or tap it again to put it back down.'
          : pa.left + ' of ' + pa.total + ' left.') + '</p>' +
        '<div class="acts">' +
        (pa.kind === 'barricade' ? '<button class="act" data-act="placerot"><span>Turn</span><small>' + (pa.vertical ? 'Running up the table' : 'Running across the table') + '</small></button>' : '') +
        '<button class="act" data-act="placedone"><span>' + (pa.left === pa.total ? 'Skip' : 'Done') + '</span><small>' +
        (pa.left === pa.total ? 'Leave the table as it is' : 'That will do') + '</small></button></div></div>';
    }
    /* Terrorist (p. 112): before deploying, the side on the Path of the Villain
       picks one destructible piece to mine — or none. */
    // Know Your Foe! (p. 141): once a battle, at the start of a turn the enemy has reinforcements coming
    function kyfCard() {
      var k = B.state.kyfAsk;
      return '<div class="card"><h2>Know Your Foe!</h2>' +
        '<p class="sub">The enemy has ' + k.n + ' unit' + (k.n === 1 ? '' : 's') + ' waiting to come on. Once a battle, the tribe may stop every enemy reinforcement arriving this turn.</p>' +
        '<div class="acts"><button class="act" data-act="kyf"><span>Hold them back</span><small>This turn — it cannot be used again</small></button>' +
        '<button class="act" data-act="nokyf"><span>Not now</span><small>Keep it for a later turn</small></button></div></div>';
    }
    // Martyrdom (p. 112): asked as each assault with Holy Warriors in it begins
    function martyrCard() {
      var m = B.state.martyrAsk, u = byId(m.unit), foe = byId(m.foe);
      if (!u || !foe) return '';
      return '<div class="card"><h2>Martyrdom</h2>' +
        '<p class="sub">' + (m.charging ? '<b>' + esc(u.name) + '</b> is charging <b>' + esc(foe.name) + '</b>'
          : '<b>' + esc(foe.name) + '</b> is charging <b>' + esc(u.name) + '</b>') +
        '. Before the first round, one of the Holy Warriors may walk into the enemy alone: ' +
        'one model is removed, and ' + esc(foe.name) + ' takes D3 automatic hits. No Suppression for the death.</p>' +
        '<div class="acts"><button class="act" data-act="martyr"><span>Send one in</span><small>' + u.models + ' models, one of them goes</small></button>' +
        '<button class="act" data-act="nomartyr"><span>Hold back</span><small>Fight the assault as it stands</small></button></div></div>';
    }
    function mineCard() {
      var mp = B.state.minePick;
      return '<div class="card"><h2>Terrorist</h2>' +
        '<p class="sub">Before anyone deploys, you may secretly mine one destructible piece of terrain other than the objective. ' +
        'Any First Among Equals unit can set it off during the battle — Firepower 10, Destructive Weapon.</p>' +
        '<p class="hint">Tap one of the ' + mp.pool.length + ' outlined pieces.</p>' +
        '<div class="acts"><button class="act" data-act="nomine"><span>No mine</span><small>Leave the charges in the crates</small></button></div></div>';
    }
    // is the insertion being asked for this screen's to answer? (on a network, the other player may be the one asked)
    function insertionMine() {
      var ins = ui.insertion;
      if (!ins) return false;
      var by = ins.by || (ins.unit ? ins.unit.side : 'A');
      return !B.watching && B.seats.indexOf(by) >= 0;
    }
    function insertionCard() {
      var ins = ui.insertion;
      if (!ins) return '';
      var u = ins.unit;
      if (!insertionMine()) {
        /* The other player is the one asked — the opponent shoving this side's
           drop, or placing their own arrival. This screen waits and says for what. */
        var byS = ins.by || (u ? u.side : 'A');
        return '<div class="card"><h2>' + (ins.kind === 'shove' ? 'Insertion' : 'Waiting') + '</h2>' +
          '<p class="sub">' + (ins.kind === 'shove' && u
            ? '<b>' + esc(u.name) + '</b> rolled a ' + ins.die + ' coming in: ' + esc(sideName(byS)) +
              ' may move its arrival point up to <b>' + ins.drift + '″</b>.'
            : esc(sideName(byS)) + ' is placing ' + (u ? '<b>' + esc(u.name) + '</b>' : 'a landing zone') + '.') + '</p>' +
          '<p class="hint">Waiting for ' + esc(sideName(byS)) + '. Battlefield Insertion, p. 56.</p></div>';
      }
      if (ins.kind === 'ilz') {
        return '<div class="card"><h2>Landing zone ' + ins.n + ' of 3</h2>' +
          '<p class="sub">The defender is down: nominate where the invasion comes in — an 8″ circle of open ground, ' +
          '8″ clear of every table edge and 12″ from the other zones. The first wave drops into one, two or all three of them.</p>' +
          '<p class="hint">Tap the shaded ground. Invasion, p. 53.</p></div>';
      }
      if (ins.kind === 'lz') {
        return '<div class="card"><h2>Landing zone</h2>' +
          '<p class="sub">' + (B.state.solo && B.state.solo.coop ? '<b>' + esc(soloOwnerName(ins.owner)) + '</b>: n' : 'N') +
          'ominate the landing zone your commando drops into — an 8″ circle of open ground, no closer than 12″ to any table edge' +
          (B.state.solo && B.state.solo.coop ? ', and 18″ from the other player\u2019s' : '') +
          '. Every unit (except vehicles) takes D3 SP as it lands.</p>' +
          '<p class="hint">Tap the shaded ground.</p></div>';
      }
      /* Two things ask the same way: a Battlefield Insertion, which may come down
         almost anywhere and can be held back, and a scenario reinforcement, which
         is coming on whether you like it or not but still lets you choose where
         along its landing zone or table edge. */
      if (ins.kind === 'shove') {
        return '<div class="card"><h2>Enemy insertion</h2>' +
          '<p class="sub"><b>' + esc(u.name) + '</b> rolled a ' + ins.die + ' coming in: you may move its arrival point up to <b>' +
          ins.drift + '″</b> in any direction. Tap the shaded ground — or its own point to leave it.</p>' +
          '<p class="hint">Battlefield Insertion, p. 56.</p></div>';
      }
      if (ins.kind === 'arrive' && u.sfOffer) {
        return '<div class="card"><h2>Semper Fidelis</h2>' +
          '<p class="sub"><b>' + esc(sfName(u)) + '</b> may come on now without waiting for its roll. Tap the shaded ground ' +
          'to bring it on — ' + esc(arrivalWhere(u)) + ' — or keep it back for a later turn.</p>' +
          '<p class="hint">' + ins.spots.length + ' place' + (ins.spots.length === 1 ? '' : 's') + ' it can come on.</p>' +
          '<div class="acts"><button class="act" data-act="holdarrive">' +
          '<span>Keep it in reserve</span><small>Call it in on a later turn</small></button></div></div>';
      }
      if (ins.kind === 'arrive') {
        return '<div class="card"><h2>Reinforcements</h2>' +
          '<p class="sub"><b>' + esc(u.name) + '</b> is arriving this turn. Tap the shaded ground ' +
          'to choose where it comes on — ' + esc(arrivalWhere(u)) + '.</p>' +
          '<p class="hint">' + ins.spots.length + ' place' + (ins.spots.length === 1 ? '' : 's') +
          ' it can come on.</p></div>';
      }
      return '<div class="card"><h2>Battlefield Insertion</h2>' +
        '<p class="sub"><b>' + esc(u.name) + '</b> is coming in. Tap anywhere in the shaded ground: ' +
        'at least 12" from every objective and 4" in from the table edge. On a D6 of 4+ your opponent ' +
        'will shove the arrival point up to 2D6".</p>' +
        '<p class="hint">' + ins.spots.length + ' legal drop point' + (ins.spots.length === 1 ? '' : 's') + ' on the table.</p>' +
        '<div class="acts"><button class="act" data-act="holdinsert">' +
        '<span>Keep it in reserve</span><small>Try again next turn</small></button></div></div>';
    }

    /* A tap is a finger, not a pixel. The ground a reinforcement may come on is
       often a band an inch or two wide down one edge of the table — thinner, at
       any sensible zoom, than the fingertip aiming at it. Demanding an exact hit
       meant the only way to place a unit was to zoom all the way in.

       So the tap is snapped to the nearest legal spot it could plausibly have
       meant. Placing a unit at deployment already forgives a near miss by nine
       inches; this is the same idea, with the fingertip's own width added on when
       the table is zoomed out far enough for that to be the larger of the two. */
    var SNAP_NEAR = 6;              // inches of forgiveness, whatever the zoom
    function snapReach() {
      // 54 buffer pixels is about a fingertip; K of them is one inch at zoom 1
      return Math.max(SNAP_NEAR, (54 / Math.max(0.2, cam.z)) / ISO.K);
    }


    return {
      anyArriving: anyArriving,
      arriving: arriving,
      boardAnim: boardAnim,
      cmdOfferCard: cmdOfferCard,
      insertionCard: insertionCard,
      insertionMine: insertionMine,
      kyfCard: kyfCard,
      landUnit: landUnit,
      martyrCard: martyrCard,
      mineCard: mineCard,
      placeCard: placeCard,
      snapReach: snapReach,
      stepOff: stepOff,
      swapCard: swapCard,
      walkOn: walkOn
    };
  };
})(window);
