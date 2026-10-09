/* PMC 2670 — Firefight : destructible terrain: shelter, shooting and blowing it down, crushing it

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDestruct = function (E) {
    var TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, applyDamage = E.applyDamage, applyResult = E.applyResult, campFlag = E.campFlag,
        chargeBonus = E.chargeBonus, clampBoard = E.clampBoard, d10 = E.d10,
        defenceAgainst = E.defenceAgainst, dmgMod = E.dmgMod, fallBack = E.fallBack, fmtPart = E.fmtPart,
        has = E.has, inRect = E.inRect, isFlying = E.isFlying, isMachine = E.isMachine,
        rectPointDist = E.rectPointDist, resolveDamage = E.resolveDamage,
        resolveShootingHits = E.resolveShootingHits, segRect = E.segRect, sizeBonus = E.sizeBonus,
        shotMods = E.shotMods, terrainAt = E.terrainAt, unitNear = E.unitNear, behindWall = E.behindWall;
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
      /* The wall it shelters behind: "behind a small/high wall" (Destructive Weapon,
         p. 57), "behind a low/high wall" (Sappers, p. 59). Low or high, judged as
         the low wall's cover is (behindWall, p. 42) so the wall that gives a unit
         its +2 is the one these bring down; against plunging fire, any wall near
         it (p. 58). A wall further off on the line of fire is not the target's
         shelter. The nearest such wall, if two. */
      var best = null, bd = Infinity;
      for (var j = 0; j < state.terrain.length; j++) {
        var r2 = state.terrain[j];
        if (!isDestructible(r2) || destructibleKind(r2) !== 'linear' || !behindWall(state, attacker, target, r2)) continue;
        var d = rectPointDist(r2, target.x, target.y);
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
      // barbed wire is cut by Sappers' hands, not shot down (p. 43)
      if (destructibleKind(r) === 'wire') return false;
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

    /* `sec`: the section of a building of several, when it is a garrison in that
       one section that brought it down (fire, or Sappers' breach) — that section
       burns and the rest stands: each section is a building of its own (p. 41). */
    function destroyTerrain(state, r, log, by, sec) {
      var kind = destructibleKind(r);
      if (!kind) return null;
      if (kind === 'building' && sec != null && r.parts && r.parts.length > 1 && r.parts[sec]) return burnSection(state, r, sec, log, by);
      var was = TERRAIN[r.kind].name;
      r.was = r.kind;                                    // what it was, so the wreck is drawn as the right kind of rubble
      r.kind = kind === 'building' ? 'burning' : kind === 'wire' ? 'cutwire' : 'razed';
      r.wrecked = true;
      var out = { piece: r, was: was, kind: r.kind, evicted: [] };
      log.push({
        t: 'kill',
        text: (by ? by.label + ' brings down ' : 'Down comes ') + was.toLowerCase() +
          (kind === 'building' ? ' — it goes up in flames.' : kind === 'wire' ? ' — a gap is cut through it.' : ' — only rubble is left.')
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
    function burnSection(state, r, sec, log, by) {
      var q = r.parts[sec], was = TERRAIN[r.kind].name;
      var fire = { kind: 'burning', x: q.x, y: q.y, w: q.w, h: q.h, wrecked: true };
      r.parts.splice(sec, 1);
      state.terrain.push(fire);
      var out = { piece: fire, was: was, kind: 'burning', evicted: [], section: true };
      log.push({ t: 'kill', text: (by ? by.label + ' brings down ' : 'Down comes ') + 'one wing of the ' + was.toLowerCase() + ' — it goes up in flames.' });
      for (var i = 0; i < state.units.length; i++) {
        var u = state.units[i];
        if (!u.alive || u.aboard || u.bld !== r) continue;
        var us = u.sec || 0;
        if (us > sec) { u.sec = us - 1; continue; }        // the wings after it close up their numbers
        if (us < sec) continue;
        u.bld = null; u.sec = null;
        var p = nearestClear(state, u, fire);
        u.x = p.x; u.y = p.y;
        out.evicted.push(u);
        log.push({ t: 'note', text: u.label + ' scrambles clear of the burning wing.' });
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

    /* Shooting a piece down on its own (p. 57): a "final D10 roll result (with
       all modifiers applied)" of 15+, or an unmodified 9. The modifiers are the
       shot's own, taken at the nearest point of the piece — Fire! for standing
       still, half range, height, Basic Firepower where it applies — less what
       only a unit can be (marked, crossfired, a vehicle's flank). */
    // the piece's name after a "the" (the Demolish objective's own name carries one: "The objective")
    function noun(r) { return TERRAIN[r.kind].name.toLowerCase().replace(/^the /, ''); }
    function shootTerrain(state, a, r) {
      var log = [];
      var roll = d10();
      var aim = {
        x: Math.max(r.x, Math.min(r.x + r.w, a.x)), y: Math.max(r.y, Math.min(r.y + r.h, a.y)),
        side: null, cls: 'terrain', alive: true, models: 1, rules: [], shotFrom: [], marked: false
      };
      var sm = shotMods(state, a, aim, 'fire', { terrain: true });
      var parts = [{ label: 'D10', v: roll }].concat(sm.parts), total = roll + sm.total;
      // Demolisher, the vehicle upgrade (p. 89): +4 Firepower against destructible terrain
      if (campFlag(a, 'demolisher')) { total += 4; parts.push({ label: 'Demolisher', v: 4 }); }
      var down = roll === 9 || total >= 15;
      log.push({
        t: 'shoot',
        text: a.label + ' fires on the ' + noun(r),
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
        text: a.label + ' sets off the charge under the ' + noun(r) + '.',
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
        text: a.label + ' sets charges against the ' + noun(r),
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' — needs 15+, or an unmodified 9 → ' +
          (down ? 'the charges blow' : 'the charges fail')
      });
      var res = down ? destroyTerrain(state, r, log, a) : null;
      if (!down) {
        fallBack(state, a, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, 2);
        log.push({ t: 'note', text: a.label + ' falls back 2" from the ' + (destructibleKind(r) === 'wire' ? 'wire' : 'wall') + '.' });
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
        // a reinforced wall is not flattened: it stops the hull instead (p. 41)
        if (destructibleKind(r) !== 'linear' || !isDestructible(r)) continue;
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
      shotMods = L.shotMods; sizeBonus = L.sizeBonus; terrainAt = L.terrainAt; unitNear = L.unitNear;
      behindWall = L.behindWall;
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
