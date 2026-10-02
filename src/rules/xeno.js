/* PMC 2670 — Firefight : the Xenotripods: senses, shields, bonds, teleports and self-repair

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCXeno = function (E) {
    var BOARD = E.BOARD, BY_KEY = E.BY_KEY, TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, addSP = E.addSP,
        campFlag = E.campFlag, centreDist = E.centreDist, currentMorale = E.currentMorale, d6 = E.d6,
        doctrine = E.doctrine, hasLoS = E.hasLoS, hasOwn = E.hasOwn, isFlying = E.isFlying,
        isMachine = E.isMachine, lineClear = E.lineClear, ruleValue = E.ruleValue, status = E.status,
        terrainAt = E.terrainAt, unitDist = E.unitDist, unitNear = E.unitNear;
    /* ---------- the Xenotripods (pp. 129-130, 140-143) ---------- */
    function isXeno(u) { return !!u && u.faction === 'xeno'; }
    // the army rules pass the drones by — and every turret is Drone Controlled
    function xenoSenses(u) { return isXeno(u) && !u.drone && !hasOwn(u, 'Drone Control'); }
    // Limited Senses: 12", or 18" with the Rite of Farsight; everyone else 36"
    function sightRange(u) {
      if (!xenoSenses(u)) return 36;
      return campFlag(u, 'farsight') ? 18 : 12;
    }
    /* Mental Projection: an enemy seen by any unbroken Xenotripod is seen by the
       whole tribe. Aircraft see over everything, but no further than 12". */
    function tribeSeers(state, side, t) {
      var out = [];
      for (var i = 0; i < state.units.length; i++) {
        var o = state.units[i];
        if (!o.alive || o.side !== side || o.aboard || o.reserve || o.x < 0 || !xenoSenses(o)) continue;
        if (campFlag(o, 'banished') || status(o) === 'broken') continue;
        if (unitDist(o, t) > sightRange(o)) continue;
        if (isFlying(o) || isFlying(t) || lineClear(state, o, t)) out.push(o);
      }
      return out;
    }
    function tribeSees(state, side, t) { return tribeSeers(state, side, t).length > 0; }
    // Dual-mode Weapons (p. 142): Indirect Fire at full modifiers on a target in sight
    function dualMode(state, a, t) {
      return !!state && doctrine(state, a.side, 'XT6') && !isFlying(a) && !!t && hasLoS(state, a, t);
    }
    // Shield Generator (p. 130): +2 from a turret, +1 from a craft, the best one only
    function shieldFor(state, attacker, target) {
      if (!state || !attacker || !target) return null;
      var best = null;
      for (var i = 0; i < state.units.length; i++) {
        var g = state.units[i];
        if (!g.alive || g.side !== target.side || g.aboard || g.reserve || g.x < 0) continue;
        var v = ruleValue(g, 'Shield Generator');
        if (!v) continue;
        // the whole unit inside the dome, and the shot fired from outside it
        if (centreDist(g, target) + UNIT_R > 12) continue;
        if (unitDist(g, attacker) <= 12) continue;
        if (!best || v > best.v) best = { v: v, from: g };
      }
      return best;
    }
    function enemyWithin(state, u, r) {
      for (var i = 0; i < state.units.length; i++) {
        var o = state.units[i];
        if (o.alive && o.side !== u.side && !o.aboard && !o.reserve && o.x >= 0 && unitDist(o, u) <= r) return true;
      }
      return false;
    }
    // Rite of Disruption (p. 142): an enemy infantry unit within 6" rallies on 6s
    function disruptedBy(state, u) {
      for (var i = 0; i < state.units.length; i++) {
        var o = state.units[i];
        if (o.alive && o.side !== u.side && !o.aboard && campFlag(o, 'disruption') && unitDist(o, u) <= 6) return o;
      }
      return null;
    }
    // Psychic Bond, the kind half: the best Morale of a friend within 6"
    function bondMorale(state, u) {
      if (!xenoSenses(u) || isMachine(u)) return null;
      var best = null;
      for (var i = 0; i < state.units.length; i++) {
        var o = state.units[i];
        if (o === u || !o.alive || o.side !== u.side || o.aboard || o.reserve || o.x < 0) continue;
        if (!xenoSenses(o) || isMachine(o) || unitDist(o, u) > 6) continue;
        // a Suppressed or Broken friend lends nothing: no passive bonus to another unit (p. 29)
        if (status(o) !== 'ready') continue;
        var m = currentMorale(o);
        if (!best || m > best.m) best = { m: m, from: o };
      }
      return best;
    }
    /* Psychic Bond, the cruel half: every model a Xenotripod unit loses puts a
       Suppression point on each friend within 6" — three under the Infamy of
       Overreaction; none under the Rite of Stability. */
    function psychicBond(state, u, lost, log) {
      if (!state || !state.units || !xenoSenses(u) || !lost) return;
      var hit = [];
      for (var i = 0; i < state.units.length; i++) {
        var o = state.units[i];
        if (o === u || !o.alive || o.side !== u.side || o.aboard || o.reserve || o.x < 0) continue;
        if (!xenoSenses(o) || isMachine(o) || campFlag(o, 'stability')) continue;
        if (unitDist(o, u) > 6) continue;
        var n = lost * (campFlag(o, 'overreaction') ? 3 : 1), was = status(o);
        addSP(o, n);
        var now = status(o);
        if (now === 'broken') o.brokenEver = true;
        hit.push(o.label + ' +' + n + (now !== was ? ' (' + now + ')' : ''));
      }
      if (hit.length && log) log.push({ t: 'hits', text: 'Psychic Bond — ' + u.label + '’s ' + lost + ' dead are felt by ' + hit.join(', ') + '.' });
    }
    /* Infamy of Panic (p. 143): a friend within 18" broken or destroyed, and the
       unit takes D6 Suppression. */
    function infamyPanic(state, u, log) {
      if (!state || !state.units) return;
      state.units.forEach(function (o) {
        if (o === u || !o.alive || o.side !== u.side || o.aboard || o.reserve || o.x < 0 || !campFlag(o, 'infamyPanic')) return;
        if (unitDist(o, u) > 18) return;
        var n = d6(), was = status(o);
        addSP(o, n);
        if (status(o) === 'broken') o.brokenEver = true;
        if (log) log.push({ t: 'hits', text: 'Infamy of Panic — ' + o.label + ' sees ' + u.label + ' go and takes ' + n + ' SP' + (status(o) !== was ? ' (' + status(o) + ')' : '') + '.' });
      });
    }
    /* Regain Control (Dominant Species, p. 129): the Crocks stand still and every
       Epsilon squad of their Tier or lower within 12" sheds all its Suppression. */
    function regainTargets(state, u) {
      return state.units.filter(function (o) {
        return o.alive && o.side === u.side && !o.aboard && !o.reserve && o.x >= 0 && o !== u &&
          BY_KEY[o.key] && BY_KEY[o.key].group === 'Epsilon Squads' && o.tier <= u.tier &&
          o.sp > 0 && unitDist(o, u) <= 12;
      });
    }
    function regainControl(state, u) {
      var log = [], freed = regainTargets(state, u);
      log.push({ t: 'rally', text: u.label + ' reaches out to the Esh-Aven — Regain Control.' });
      freed.forEach(function (o) {
        log.push({ t: 'rally', text: o.label + ' — ' + o.sp + ' SP gone.' });
        o.sp = 0;
      });
      if (!freed.length) log.push({ t: 'note', text: 'No shaken Epsilon squad within 12" to steady.' });
      return { log: log, freed: freed };
    }
    // Self-repair (Molecular Reconstruction, p. 129): stay still, lose every Damage point
    function selfRepair(state, u) {
      var was = u.damage || 0;
      u.damage = 0;
      return { log: [{ t: 'rally', text: u.label + ' rebuilds itself — Molecular Reconstruction clears ' + was + ' Damage.' }], cleared: was };
    }
    /* Teleport (p. 130): a Teleport unit takes in one infantry unit that could board
       it, "following standard embarking rules" (p. 36), and on a D6 of 1-2 it comes
       out at a random Teleport unit — perhaps the same one — and on 3-6 at the one
       its owner picks. It is not an activation. As with any boarding, the unit
       taken in may have acted already this turn, must come out of a building
       first, and loses its Suppression on the way through. */
    function teleportFrom(state, tp) {
      return state.units.filter(function (u) {
        if (!u.alive || u.side !== tp.side || u.aboard || u.reserve || u.x < 0) return false;
        if (u.cls !== 'infantry' || u.disembarked || u.bld || hasOwn(u, 'Riders')) return false;
        if (hasOwn(u, 'Stationary Artillery')) return false;      // a gun goes on a hook, not through a gate
        if (campFlag(u, 'backward')) return false;              // Infamy of Backwardness
        if (status(u) !== 'ready') return false;
        return unitDist(u, tp) <= 4;
      });
    }
    function teleportPads(state, side) {
      return state.units.filter(function (u) {
        return u.alive && u.side === side && !u.aboard && !u.reserve && u.x >= 0 && hasOwn(u, 'Teleport');
      });
    }
    function teleportRoll(state, u, tp) {
      var r = d6(), second = null;
      /* Rite of Knowledge (p. 142): a 1-3 "may" be rolled again, and the second stands.
         Taken on a 1-2 (a random pad) and never on a 3, which already lets the owner
         pick the pad — a re-roll could only lose that (rules review a119ac2 XEN-3). */
      if (r <= 2 && campFlag(u, 'knowledge')) { second = d6(); }
      var v = second != null ? second : r;
      var pads = teleportPads(state, tp.side);
      var randomPad = pads[Math.floor(Math.random() * pads.length)] || tp;
      /* Auxiliary Teleportation System (p. 143): on a 2-3 the unit may come out
         beside an aircraft carrying it instead. On a 2 that is the only choice
         there is — the random pad, or the aircraft; on a 3 the aircraft joins the
         owner's usual pick of pads. */
      var aux = state.units.filter(function (o) {
        return o.alive && o.side === tp.side && o.cls === 'aircraft' && o.x >= 0 && campFlag(o, 'auxTeleport');
      });
      if (v === 2 && aux.length) {
        return { roll: r, reroll: second, value: v, random: false, pads: [randomPad].concat(aux), aux: aux, randomPad: randomPad };
      }
      if (v === 3 && aux.length) {
        return { roll: r, reroll: second, value: v, random: false, pads: pads.concat(aux), aux: aux, randomPad: randomPad };
      }
      return { roll: r, reroll: second, value: v, random: v <= 2, pads: pads, randomPad: randomPad };
    }
    function teleport(state, u, from, to) {
      // drop the unit onto clear ground within 4" of the exit pad
      var best = null;
      for (var ring = 2.2; ring <= 4 && !best; ring += 0.6) {
        for (var k = 0; k < 16; k++) {
          var ang = k * Math.PI / 8 + (ring * 0.7);
          var x = to.x + Math.cos(ang) * ring, y = to.y + Math.sin(ang) * ring;
          if (x < 1 || y < 1 || x > BOARD.w - 1 || y > BOARD.h - 1) continue;
          if (TERRAIN[terrainAt(state, x, y)].impassable || unitNear(state, x, y, u, 0.2)) continue;
          best = { x: x, y: y }; break;
        }
      }
      if (!best) return { ok: false, text: 'There is no room at ' + to.label + ' — ' + u.label + ' stays where it is.' };
      var was = { x: u.x, y: u.y };
      u.bld = null; u.sec = null;
      u.x = best.x; u.y = best.y;
      u.sp = 0;                                               // "loaded troops automatically lose all their Suppression points" (p. 36)
      u.disembarked = true;                                   // "embarked" — not back through the same turn
      return { ok: true, from: was, text: u.label + ' vanishes at ' + from.label + ' and steps out beside ' + to.label + '.' };
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      BOARD = L.BOARD; BY_KEY = L.BY_KEY; TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R; addSP = L.addSP;
      campFlag = L.campFlag; centreDist = L.centreDist; currentMorale = L.currentMorale; d6 = L.d6;
      doctrine = L.doctrine; hasLoS = L.hasLoS; hasOwn = L.hasOwn; isFlying = L.isFlying;
      isMachine = L.isMachine; lineClear = L.lineClear; ruleValue = L.ruleValue; status = L.status;
      terrainAt = L.terrainAt; unitDist = L.unitDist; unitNear = L.unitNear;
    }

    return {
      relink: relink,
      isXeno: isXeno, xenoSenses: xenoSenses, sightRange: sightRange, tribeSeers: tribeSeers,
      tribeSees: tribeSees, dualMode: dualMode, shieldFor: shieldFor, enemyWithin: enemyWithin,
      disruptedBy: disruptedBy, bondMorale: bondMorale, psychicBond: psychicBond, infamyPanic: infamyPanic,
      regainTargets: regainTargets, regainControl: regainControl, selfRepair: selfRepair,
      teleportFrom: teleportFrom, teleportPads: teleportPads, teleportRoll: teleportRoll, teleport: teleport
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCXeno;
})(typeof window !== 'undefined' ? window : global);
