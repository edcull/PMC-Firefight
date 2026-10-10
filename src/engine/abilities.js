/* PMC 2670 — Firefight : unit abilities: regaining control, leaders, medics, repair, jamming, teleporting

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineAbilities = function (E) {
    var R = E.R, SFX = E.SFX, V = E.V, addFx = E.addFx, aiPadFor = E.aiPadFor, canStand = E.canStand,
        chargeAllow = E.chargeAllow, endActivation = E.endActivation, glowRGB = E.glowRGB, isAI = E.isAI,
        logLine = E.logLine, pushRes = E.pushRes, render = E.render, repaintTerrain = E.repaintTerrain,
        revealConsole = E.revealConsole, setHint = E.setHint, ui = E.ui, whenIdle = E.whenIdle;

    /* ---------- the Xenotripods' special actions ---------- */
    function doRegain(u) {
      u.activated = true;
      ui.mode = 'idle'; ui.targets = []; ui.moves = [];
      var res = R.regainControl(E.state, u);
      res.log.forEach(function (l) { logLine(l.t, l.text); });
      addFx({ kind: 'wave', x: u.x, y: u.y, up: 0, r: 12, rgb: glowRGB(u), dur: 1100, blocking: true });
      if (SFX && SFX.shimmer) SFX.shimmer();
      pushRes({ kind: 'Regain Control', title: u.name + ' — Regain Control', side: u.side,
        note: 'Dominant Species: every Epsilon squad of Tier ' + R.ROMAN[u.tier] + ' or lower within 12" removes all its Suppression.',
        list: res.log.slice(1).map(function (l) { return { text: l.text, side: u.side }; }),
        outcome: { text: res.freed.length ? res.freed.length + ' squad' + (res.freed.length > 1 ? 's' : '') + ' steadied.' : 'Nobody needed it.', tone: res.freed.length ? 'good' : '' } });
      render();
      endActivation(u);
    }

    /* ---- abilities, seen as they bite ----
       Every shot, charge, rally and repair goes through these, so a rule that
       changed the outcome shows on the table as it does: a medic's save, a
       Xenotripod shield taking the shot, pheromone trails guiding a bug in,
       an enemy's jamming. */
    function abShoot(st, a, t, mode, opts) {
      var sh = !(opts && opts.assault) && a && t ? R.shieldFor(st, a, t) : null;
      var trails = pheromoneMarkers(a, t);
      if (!(opts && opts.assault)) keenFx(a, t, 6);
      var res = R.shoot(st, a, t, mode, opts);
      abilityFx(res, t, sh, trails);
      // whatever the shot brought down is repainted, whoever fired it and why
      if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
      return res;
    }
    /* Martyrdom (p. 112) is ordered as each assault begins, attacking or
       defending: a player's Holy Warriors are asked, and the assault waits for
       the answer; the AI decides for its own. `go(martyr)` runs the assault. */
    function martyrFirst(a, t, go) {
      var ask = [a, t].filter(function (u, i) {
        return !isAI(u.side) && R.canMartyr(E.state, u, i ? a : t);
      });
      if (!ask.length) { go({}); return; }
      var said = {};
      (function next() {
        var u = ask.shift();
        if (!u) { E.state.martyrAsk = null; ui.martyrThen = null; go(said); return; }
        E.state.martyrAsk = { unit: u.id, foe: (u === a ? t : a).id, side: u.side, charging: u === a };
        ui.martyrThen = function (yes) { said[u.side] = !!yes; next(); };
        setHint(null, 'Martyrdom — ' + u.name + ' may send one of its own in alone.');
        revealConsole();
        render();
      })();
    }
    function abAssault(st, a, t, martyr, noSap) {
      var trails = pheromoneMarkers(a, t);
      // "Death or Glory, Comrades!": the leader's shout, and the charge throwing off its Suppression
      var shout = a && a.sp ? R.deathOrGlory(st, a) : null;
      if (shout) {
        addFx({ kind: 'beam', x: shout.x, y: shout.y, tx: a.x, ty: a.y, rgb: '235,85,70', dur: 900, blocking: true });
        addFx({ kind: 'wave', x: a.x, y: a.y, up: 0, r: 3, rgb: '235,85,70', delay: 200, dur: 1100 });
        // and on the unit it reaches: the red of the shout rising off it as its Suppression goes
        addFx({ kind: 'rise', x: a.x, y: a.y, rgb: '235,85,70', n: 10, delay: 250, dur: 1500, blocking: true });
      }
      // Sappers: charges set against the wall or building the enemy is sheltering behind
      var cover = a && t && !noSap && R.has(a, 'Sappers') && !R.isMachine(t) ? R.shelterOf(st, a, t) : null;
      if (cover) addFx({ kind: 'charges', x: cover.x + cover.w / 2, y: cover.y + cover.h / 2, r: Math.min(cover.w, cover.h) / 2 + 0.5, dur: 1300, xeno: R.isXeno(a) });
      var route = a && t && !a.bld ? R.chargeRoute(st, a, t, chargeAllow(a) + 0.5) : null;
      var res = R.assault(st, a, t, { path: route ? route.path : null, martyr: martyr || {}, noSap: !!noSap });
      abilityFx(res, t, null, trails);
      // whatever the assault brought down is repainted, whoever made it (as for a shot)
      if (res.wreck) whenIdle(function () { repaintTerrain([res.wreck]); });
      return res;
    }
    function abRally(st, u, opts) { jamFx(u); leaderFx(u); return R.rally(st, u, opts); }
    /* A rally helped along by a leader: "…but they'll never take our freedom!"
       (three more dice) or Inspiring Presence (failures re-rolled) — the call
       from the leader, and the unit steadying under it. */
    function leaderFx(u) {
      if (!u || !u.sp || R.isMachine(u)) return;
      var free = R.freedomDice(E.state, u) > 0 ? nearestWith(u, '…but they\'ll never take our freedom!', 18) : null;
      var insp = !free && R.inspiringNearby && R.inspiringNearby(E.state, u) ? nearestWith(u, 'Inspiring Presence', 12) : null;
      var o = free || insp;
      if (!o) return;
      var rgb = free ? '240,120,80' : '232,193,90';
      addFx({ kind: 'beam', x: o.x, y: o.y, tx: u.x, ty: u.y, rgb: rgb, dur: 1000, blocking: true });
      addFx({ kind: 'rise', x: u.x, y: u.y, rgb: rgb, n: 8, delay: 250, dur: 1300, blocking: true });
    }
    function nearestWith(u, rule, reach) {
      return E.state.units.filter(function (o) {
        return o !== u && o.alive && !o.aboard && o.x >= 0 && o.side === u.side && R.has(o, rule) && R.unitDist(o, u) <= reach;
      }).sort(function (a, b) { return R.unitDist(a, u) - R.unitDist(b, u); })[0] || null;
    }
    function abRepair(st, u) { if (u && u.damage) jamFx(u); return R.repair(st, u); }
    // the friendly marker bugs within reach of the target, when their pheromones are guiding this attack in
    function pheromoneMarkers(a, t) {
      if (!a || !t || !(R.pheromoneBonus(E.state, a, t) > 0)) return [];
      var reach = R.doctrine(E.state, a.side, 'BC3') ? 24 : 18;
      return E.state.units.filter(function (o) {
        return o.side === a.side && o.alive && !o.aboard && o.x >= 0 && R.has(o, 'Pheromone Markers') && R.unitDist(o, t) <= reach;
      });
    }
    function abilityFx(res, t, sh, trails) {
      if (!t) return;
      (trails || []).forEach(function (o) {
        addFx({ kind: 'beam', x: o.x, y: o.y, tx: t.x, ty: t.y, up: 0.5, rgb: '170,230,90', dur: 1100, blocking: true });
      });
      if (sh && sh.from) addFx({ kind: 'dome', x: sh.from.x, y: sh.from.y, r: 12, delay: 250, dur: 1500 });
      if (res && res.medic) medicFx(t, res.medic, 500);
    }
    /* A MEDIC! on the injury table, whatever put the squad on it: a line to the
       squad from the medics treating it (none when the medic team is patching
       up its own), and green crosses rising off it. */
    function medicFx(t, medicId, delay) {
      var med = medicId && E.state.units.filter(function (o) { return o.id === medicId; })[0];
      if (!t || !med) return;
      if (med !== t) addFx({ kind: 'beam', x: med.x, y: med.y, tx: t.x, ty: t.y, rgb: '120,230,150', delay: delay, dur: delay + 1300, blocking: true });
      addFx({ kind: 'rise', x: t.x, y: t.y, glyph: 'cross', delay: delay + (med !== t ? 250 : 0), dur: delay + 1900, blocking: true });
    }
    /* Keen-Eyed: a spotter seeing straight through a Stealth unit's
       concealment — a glint off its optics, and one on the unit it picks out.
       Stealth only counts from `from` inches on, so nearer than that nothing shows. */
    function keenFx(a, t, from) {
      if (!a || !t || !R.has(a, 'Keen-Eyed') || !R.has(t, 'Stealth') || R.unitDist(a, t) < from) return;
      addFx({ kind: 'glint', unit: a.id, x: a.x, y: a.y, dur: 700 });
      addFx({ kind: 'glint', x: t.x, y: t.y, up: 0.8, delay: 250, dur: 700 });
    }
    // a rally or repair made harder by an enemy's Jammers: the static rolling out from the jammer
    function jamFx(u) {
      if (!u || !R.jammedNearby(E.state, u)) return;
      var j = E.state.units.filter(function (e) {
        return e.alive && !e.aboard && e.x >= 0 && e.side !== u.side && R.has(e, 'Jammers') && R.unitDist(e, u) <= 24;
      }).sort(function (a, b) { return R.unitDist(a, u) - R.unitDist(b, u); })[0];
      if (j) addFx({ kind: 'wave', x: j.x, y: j.y, up: 0, r: 24, rgb: '200,215,225', dash: true, dur: 1300 });
    }

    function doSelfRepair(u) {
      ui.mode = 'idle'; ui.targets = []; ui.moves = [];
      var res = R.selfRepair(E.state, u);
      /* Emergency Batteries (p. 143): the aircraft may still fly its Movement as
         part of the Self-repair — the player picks where; the OpFor stays put. */
      if (u.cls === 'aircraft' && R.campFlag(u, 'batteries') && !isAI(u.side)) {
        res.log.forEach(function (l) { logLine(l.t, l.text); });
        u.repairMove = true;
        ui.selected = u; ui.mode = 'move';
        ui.moves = R.reachable(E.state, u, u.move).filter(function (c) { return canStand(u, c); });
        ui.moves.push({ x: u.x, y: u.y, cost: 0, spent: 0, turns: 0 });
        setHint(null, 'Emergency Batteries: repaired — now fly up to ' + u.move + '", or tap the craft to stay.');
        render();
        return;
      }
      u.activated = true;
      res.log.forEach(function (l) { logLine(l.t, l.text); });
      addFx({ kind: 'wave', x: u.x, y: u.y, up: V.flyLift(u), r: 2.5, rgb: glowRGB(u), dur: 900, blocking: true });
      addFx({ kind: 'rise', x: u.x, y: u.y, rgb: '120,220,255', n: 12, dur: 1500, blocking: true });   // the machine knitting itself back together
      pushRes({ kind: 'Repair', title: u.name + ' — Self-repair', side: u.side,
        note: 'Molecular Reconstruction: the unit stays where it is and removes every Damage point.',
        outcome: { text: res.cleared + ' Damage cleared — Structure ' + u.str + ' intact.', tone: 'good' } });
      render();
      endActivation(u);
    }

    /* Teleport (p. 130): the pad takes the unit in, then the dice say where it
       comes out — a random pad on 1-2, the owner's choice on 3-6. */
    function doTeleport(tp, u) {
      if (!tp || !u) return;
      var roll = R.teleportRoll(E.state, u, tp);
      var pads = roll.pads;
      ui.teleport = { tp: tp, u: u, roll: roll };
      if (roll.random || pads.length <= 1 || isAI(tp.side)) {
        finishTeleport(ui.teleport, roll.random ? roll.randomPad : (ui.teleportPick || aiPadFor(u, pads) || tp));
        return;
      }
      ui.mode = 'teleport-dest';
      ui.targets = pads;
      setHint(null, 'Teleport — D6 ' + roll.value + ': choose the pad ' + u.name + ' comes out at.');
      render();
    }

    function finishTeleport(tpc, dest, pos) {
      if (!tpc || !dest) return;
      var tp = tpc.tp, u = tpc.u, roll = tpc.roll;
      /* The unit "is immediately disembarked by a Teleport unit" (p. 130): a player
         puts it down where they like within 4" of the pad, as off any hull (XEN-7). */
      if (!pos && !isAI(tp.side)) {
        var spots = R.dropSpots(E.state, dest, u);
        if (spots.length) {
          ui.teleport = { tp: tp, u: u, roll: roll, dest: dest };
          ui.mode = 'teleport-spot'; ui.targets = []; ui.moves = spots;
          setHint(null, 'Teleport — ' + u.name + ' comes out at ' + dest.name + ': put it down within 4" of the pad.');
          render();
          return;
        }
      }
      ui.teleport = null; ui.teleportPick = null;
      var from = { x: u.x, y: u.y };
      var res = R.teleport(E.state, u, tp, dest, pos);
      logLine('note', res.text);
      if (res.ok && SFX && SFX.shimmer) SFX.shimmer();
      if (res.ok) {
        addFx({ kind: 'tplink', fromId: tp.id, toId: dest.id, from: { x: tp.x, y: tp.y }, to: { x: dest.x, y: dest.y }, rgb: glowRGB(u), dur: 1500, blocking: true });
        addFx({ kind: 'wave', x: from.x, y: from.y, up: 0, r: 2, rgb: glowRGB(u), dur: 700, blocking: true });
        addFx({ kind: 'wave', x: u.x, y: u.y, up: 0, r: 2, rgb: glowRGB(u), delay: 350, dur: 1050, blocking: true });
        addFx({ kind: 'teleportin', x: u.x, y: u.y, r: 1.4, delay: 250, dur: 1400, blocking: true });   // the column it comes out of
        ui.vis = null; ui.visKey = '';
      }
      tp.activated = true;
      ui.mode = 'idle'; ui.targets = []; ui.moves = [];
      pushRes({ kind: 'Teleport', title: tp.name + ' → ' + dest.name, side: tp.side,
        dice: [{ label: 'D6', value: roll.roll, tone: roll.random && roll.reroll == null ? 'fail' : '' }]
          .concat(roll.reroll != null ? [{ label: 'Knowledge', value: roll.reroll, tone: roll.random ? 'fail' : '' }] : []),
        note: roll.random ? '1-2: the unit comes out at a random Teleport unit.' : '3-6: the unit comes out where its owner chose.',
        outcome: { text: res.text + (res.ok && !u.activated ? ' It may still act this turn.' : ''), tone: res.ok ? 'good' : 'warn' } });
      render();
      endActivation(tp);
    }

    return {
      doRegain: doRegain, abShoot: abShoot, martyrFirst: martyrFirst, abAssault: abAssault, abRally: abRally,
      abRepair: abRepair, medicFx: medicFx, keenFx: keenFx, doSelfRepair: doSelfRepair,
      doTeleport: doTeleport, finishTeleport: finishTeleport
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineAbilities;
})(typeof window !== 'undefined' ? window : global);
