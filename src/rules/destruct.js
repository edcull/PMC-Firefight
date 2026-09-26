/* PMC 2670 — Firefight : destructible terrain: shelter, shooting and blowing it down, crushing it

   Made once by rules.js, the first time it is wanted. E is what it needs
   of rules.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDestruct = function (E) {
    var TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, applyDamage = E.applyDamage, applyResult = E.applyResult,
        chargeBonus = E.chargeBonus, clampBoard = E.clampBoard, d10 = E.d10,
        defenceAgainst = E.defenceAgainst, dmgMod = E.dmgMod, fallBack = E.fallBack, fmtPart = E.fmtPart,
        has = E.has, inRect = E.inRect, isFlying = E.isFlying, isMachine = E.isMachine,
        rectPointDist = E.rectPointDist, resolveDamage = E.resolveDamage,
        resolveShootingHits = E.resolveShootingHits, segRect = E.segRect, sizeBonus = E.sizeBonus,
        terrainAt = E.terrainAt, unitNear = E.unitNear;
    /* ---------- destructible terrain (pp. 41-43, 57-58) ----------
       Low walls, high walls and ordinary buildings can be brought down; reinforced
       walls and bunkers, woods, ruins and rocks cannot. A demolished wall leaves
       rubble that no longer shelters anyone; a demolished building burns, blocking
       sight and barring the ground, and whoever was inside has to get out. */
    function isDestructible(r) {
      var t = TERRAIN[r && r.kind];
      if (r && r.reinforced) return false;               // a reinforced wall stands whatever is thrown at it (p. 41)
      return !!(t && t.destructible);
    }
    function destructibleKind(r) {
      var t = TERRAIN[r && r.kind];
      return t ? t.destructible : null;
    }
    // the piece a unit is standing in or sheltering behind, from this attacker's side
    function shelterOf(state, attacker, target) {
      for (var i = 0; i < state.terrain.length; i++) {
        var r = state.terrain[i];
        if (!isDestructible(r)) continue;
        if (inRect(target.x, target.y, r)) return r;
      }
      if (!attacker) return null;
      /* The low wall it shelters behind — the one that gives it its cover (see
         coverFor, p. 42): within 2" of the whole unit, and between it and the
         shooter, or on any side of it against plunging fire (p. 58). A wall
         further off on the line of fire is not the target's shelter, and is not
         what a shot at the target brings down. The nearest such wall, if two. */
      var plunging = has(attacker, 'Indirect Fire'), best = null, bd = Infinity;
      for (var j = 0; j < state.terrain.length; j++) {
        var r2 = state.terrain[j];
        if (!isDestructible(r2) || TERRAIN[r2.kind].blocks) continue;
        if (inRect(attacker.x, attacker.y, r2)) continue;
        var d = rectPointDist(r2, target.x, target.y);
        if (d + UNIT_R > 2 + 1e-6) continue;
        if (!plunging && !segRect(attacker.x, attacker.y, target.x, target.y, r2)) continue;
        if (d < bd) { bd = d; best = r2; }
      }
      return best;
    }
    // Incendiary Ammunition counts as a Destructive Weapon against buildings
    /* Shooting a piece of terrain down (p. 57): a Destructive Weapon against
       anything, Incendiary Ammunition against a building. The Demolish scenario's
       objective can only be brought down by the Demolish action, not by gunfire,
       so a machine needs a Destructive Weapon even for that. */
    function canDemolish(u, r) {
      if (!isDestructible(r)) return false;
      // the Demolish objective "can be destroyed only with the Demolish special action" (p. 54): not by fire
      if (destructibleKind(r) === 'target') return false;
      if (has(u, 'Destructive Weapon')) return true;
      return destructibleKind(r) === 'building' && has(u, 'Incendiary Ammunition');
    }

    /* Putting charges against a piece by hand — the Demolish special action, which
       is resolved as an assault (pp. 58-59). Sappers may do it to any destructible
       piece; in the Demolish scenario "all units can make the Demolish special
       action targetting the objective" (p. 54) and "ALL attacking infantry units
       are allowed to demolish it, but only Sappers can demolish other objects"
       (p. 49) — at +2 rather than the Sappers' +4. Nobody assaults with a
       Cumbersome Weapon, and vehicles do not assault at all. */
    function canCharge(u, r) {
      if (!isDestructible(r) || !u) return false;
      if (isMachine(u) || u.cls !== 'infantry') return false;
      if (has(u, 'Cumbersome Weapon')) return false;
      if (has(u, 'Sappers')) return true;
      return destructibleKind(r) === 'target';
    }

    function destroyTerrain(state, r, log, by) {
      var kind = destructibleKind(r);
      if (!kind) return null;
      var was = TERRAIN[r.kind].name;
      r.kind = kind === 'building' ? 'burning' : 'razed';
      r.wrecked = true;
      var out = { piece: r, was: was, kind: r.kind, evicted: [] };
      log.push({
        t: 'kill',
        text: (by ? by.label + ' brings down ' : 'Down comes ') + was.toLowerCase() +
          (kind === 'building' ? ' — it goes up in flames.' : ' — only rubble is left.')
      });
      if (kind === 'building') {
        // the burning shell is impassable, so anyone inside must leave at once
        for (var i = 0; i < state.units.length; i++) {
          var u = state.units[i];
          if (!u.alive || u.aboard || u.x < 0) continue;
          if (u.bld !== r && !inRect(u.x, u.y, r)) continue;
          u.bld = null; u.sec = null;
          var p = nearestClear(state, u, r);
          u.x = p.x; u.y = p.y;
          out.evicted.push(u);
          log.push({ t: 'note', text: u.label + ' scrambles clear of the burning building.' });
        }
      }
      return out;
    }
    // the closest point outside a piece that the unit can actually stand on
    function nearestClear(state, u, r) {
      for (var step = 1; step <= 24; step++) {
        for (var a = 0; a < 12; a++) {
          var ang = a * Math.PI / 6;
          var x = u.x + Math.cos(ang) * (step * 0.5), y = u.y + Math.sin(ang) * (step * 0.5);
          var p = clampBoard({ x: x, y: y });
          if (inRect(p.x, p.y, r)) continue;
          if (TERRAIN[terrainAt(state, p.x, p.y)].impassable) continue;
          if (unitNear(state, p.x, p.y, u, 0.2)) continue;
          return p;
        }
      }
      return clampBoard({ x: u.x + 2, y: u.y + 2 });
    }

    /* Shooting a piece down on its own (p. 57): a final 15+, or an unmodified 9. */
    function shootTerrain(state, a, r) {
      var log = [], parts = [], total = 0;
      var roll = d10();
      total = roll; parts.push({ label: 'D10', v: roll });
      total += a.fp; parts.push({ label: 'Firepower', v: a.fp });
      var sb = sizeBonus(a.models);
      if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }
      if (has(a, 'Demolisher')) { total += 4; parts.push({ label: 'Demolisher', v: 4 }); }
      var down = roll === 9 || total >= 15;
      log.push({
        t: 'shoot',
        text: a.label + ' fires on the ' + TERRAIN[r.kind].name.toLowerCase(),
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
          (down ? 'it comes down' : 'it holds')
      });
      var res = down ? destroyTerrain(state, r, log, a) : null;
      a.activated = true;
      return { log: log, down: down, result: res, total: total, roll: roll };
    }

    /* Terrorist (Path of the Villain, p. 112). A piece of terrain was mined before
       the battle; any First Among Equals may set it off from anywhere on the table.
       It resolves as a shooting attack at Firepower 10 with Destructive Weapon —
       so the piece itself almost always goes, and anyone sheltering in it is
       caught by the same blast. */
    function detonate(state, a, r) {
      var log = [], parts = [];
      var roll = d10(), total = roll + 10;
      parts.push({ label: 'D10', v: roll });
      parts.push({ label: 'Firepower (charge)', v: 10 });
      var down = roll === 9 || total >= 15;
      log.push({
        t: 'shoot',
        text: a.label + ' sets off the charge under the ' + TERRAIN[r.kind].name.toLowerCase() + '.',
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
          (down ? 'it comes down' : 'it holds')
      });
      // whoever was sheltering in it takes the blast, Firepower 10 and Destructive
      var caught = state.units.filter(function (u) {
        return u.alive && !u.aboard && !isFlying(u) && inRect(u.x, u.y, r);
      });
      var res = down ? destroyTerrain(state, r, log, a) : null, treated = [];
      caught.forEach(function (u) {
        var hits = Math.max(0, total - defenceAgainst(state, a, u, { basic: true }).value);
        if (!hits) {
          log.push({ t: 'note', text: u.label + ' rides out the blast.' });
          return;
        }
        if (isMachine(u)) {
          var dm = resolveDamage(u, hits, false, dmgMod(state, a, u));
          log.push({ t: 'hits', text: dm.rolls.join(' · ') });
          applyDamage(state, u, dm.damage, log, a);
        } else {
          var hr = resolveShootingHits(state, u, hits, dmgMod(state, a, u), a);
          if (hr.medic) treated.push({ id: u.id, medic: hr.medic });
          log.push({ t: 'hits', text: hr.rolls.join(' · ') });
          applyResult(state, u, hr, log, a);
        }
      });
      state.mined = null;
      a.activated = true;
      // `treated`: each squad caught in it that a MEDIC! answered for, and who answered
      return { log: log, down: down, result: res, total: total, roll: roll, treated: treated };
    }

    /* Sappers going in with charges (p. 58): the same threshold, +4 for the rule,
       and a 2" fall-back if the wall holds. */
    function assaultTerrain(state, a, r) {
      var log = [], parts = [], total = 0;
      var roll = d10();
      total = roll; parts.push({ label: 'D10', v: roll });
      total += a.assault; parts.push({ label: 'Assault', v: a.assault });
      var sb = sizeBonus(a.models);
      if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }
      var bonus = chargeBonus(a, r);
      if (bonus) { total += bonus; parts.push({ label: bonus === 4 ? 'Sappers' : 'demolition charges', v: bonus }); }
      var down = roll === 9 || total >= 15;
      log.push({
        t: 'assault',
        text: a.label + ' sets charges against the ' + TERRAIN[r.kind].name.toLowerCase(),
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
          (down ? 'the charges blow' : 'the charges fail')
      });
      var res = down ? destroyTerrain(state, r, log, a) : null;
      if (!down) {
        fallBack(state, a, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, 2);
        log.push({ t: 'note', text: a.label + ' falls back 2" from the wall.' });
      }
      a.activated = true;
      return { log: log, down: down, result: res, total: total, roll: roll };
    }

    /* A Tier III-V vehicle simply drives through a low or high wall (p. 35). */
    function crushOnMove(state, u, from, to, log) {
      if (u.cls !== 'vehicle' || u.tier < 3) return [];
      var gone = [];
      for (var i = 0; i < state.terrain.length; i++) {
        var r = state.terrain[i];
        if (destructibleKind(r) !== 'linear') continue;
        if (!segRect(from.x, from.y, to.x, to.y, r) && !inRect(to.x, to.y, r)) continue;
        var res = destroyTerrain(state, r, log, u);
        if (res) gone.push(res);
      }
      return gone;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R; applyDamage = L.applyDamage; applyResult = L.applyResult;
      chargeBonus = L.chargeBonus; clampBoard = L.clampBoard; d10 = L.d10; defenceAgainst = L.defenceAgainst;
      dmgMod = L.dmgMod; fallBack = L.fallBack; fmtPart = L.fmtPart; has = L.has; inRect = L.inRect;
      isFlying = L.isFlying; isMachine = L.isMachine; rectPointDist = L.rectPointDist;
      resolveDamage = L.resolveDamage; resolveShootingHits = L.resolveShootingHits; segRect = L.segRect;
      sizeBonus = L.sizeBonus; terrainAt = L.terrainAt; unitNear = L.unitNear;
    }

    return {
      relink: relink,
      isDestructible: isDestructible, destructibleKind: destructibleKind, shelterOf: shelterOf,
      canDemolish: canDemolish, canCharge: canCharge, destroyTerrain: destroyTerrain,
      nearestClear: nearestClear, shootTerrain: shootTerrain, detonate: detonate,
      assaultTerrain: assaultTerrain, crushOnMove: crushOnMove
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDestruct;
})(typeof window !== 'undefined' ? window : global);
