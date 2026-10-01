/* PMC 2670 — Firefight : shooting: facings, range, sight, modifiers, odds and the shot itself

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCShoot = function (E) {
    var TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, angleWrap = E.angleWrap, antiTank = E.antiTank,
        applyDamage = E.applyDamage, applyResult = E.applyResult, arcOf = E.arcOf, bugRanged = E.bugRanged,
        campFlag = E.campFlag, canDemolish = E.canDemolish, centreDist = E.centreDist, d10 = E.d10,
        defenceAgainst = E.defenceAgainst, destroyTerrain = E.destroyTerrain, dmgMod = E.dmgMod,
        doctrine = E.doctrine, dualMode = E.dualMode, flyInf = E.flyInf, fmtPart = E.fmtPart, has = E.has,
        hasLoS = E.hasLoS, hasOwn = E.hasOwn, inFireArc = E.inFireArc, isFlying = E.isFlying,
        isMachine = E.isMachine, kindsUnder = E.kindsUnder, levelOf = E.levelOf, lineClear = E.lineClear,
        mountOf = E.mountOf, pheromoneBonus = E.pheromoneBonus, pointSegDist = E.pointSegDist,
        propOf = E.propOf, resolveDamage = E.resolveDamage, resolveShootingHits = E.resolveShootingHits, shotRelief = E.shotRelief,
        ruleValue = E.ruleValue, sectionHigh = E.sectionHigh, sectionRect = E.sectionRect,
        shelterOf = E.shelterOf, sightRange = E.sightRange, sizeBonus = E.sizeBonus, status = E.status,
        tribeSees = E.tribeSees, undisciplined = E.undisciplined, unitDist = E.unitDist,
        xenoSenses = E.xenoSenses;
    /* ---------- shooting ---------- */
    /* "Dig in!" (p. 94): the crew drag the trails round and shoot over open sights.
       The piece loses its reach and its all-round traverse, and gains everything a
       direct-fire gun has — full modifiers instead of Basic Firepower. */

    /* The eight facings a model can be turned to: 45° apart on the table itself,
       named by where they point on the screen — E (straight to the right), SE,
       S (straight down), and round. */
    var FACINGS = (function () {
      var out = [];
      for (var i = 0; i < 8; i++) out.push(-Math.PI / 4 + i * Math.PI / 4);
      return out;
    })();
    function nearestFacing(ang) {
      var best = FACINGS[0], bd = Infinity;
      FACINGS.forEach(function (f) {
        var d = Math.abs(angleWrap(ang - f));
        if (d < bd) { bd = d; best = f; }
      });
      return best;
    }
    function dugIn(u) { return !!(u && u.dugIn && hasOwn(u, 'Stationary Artillery')); }
    // is the shooter out in front of the dug-in gun, where its sandbags lie between them?
    function sandbagged(gun, shooter) {
      var f = gun.facing == null ? (gun.side === 'B' ? Math.PI : 0) : gun.facing;
      var d = angleWrap(Math.atan2(shooter.y - gun.y, shooter.x - gun.x) - f);
      return Math.abs(d) <= Math.PI / 3;
    }
    function shotRange(a) { return dugIn(a) ? Math.min(a.range, 24) : a.range; }
    function shotMinRange(a) { return dugIn(a) ? 6 : ruleValue(a, 'Minimum Range'); }

    function canShoot(state, a, t, mode, opts) {
      opts = opts || {};
      if (!a.alive || !t.alive || a.side === t.side || a.fp === null) return false;
      /* Only what is on the table can be shot at. A unit held in reserve is parked
         just off the table's corner at (-1, -1), and a unit riding inside a hull is
         not there at all; neither is a target, however close the numbers say. */
      if (t.reserve || t.aboard || t.x < 0 || t.y < 0) return false;
      if (!opts.aux) {
        // a main weapon set up for one kind of target cannot engage the other
        if (has(a, 'Specialisation (air)') && !isFlying(t)) return false;
        if (has(a, 'Specialisation (ground)') && isFlying(t)) return false;
        // a fixed mount only bears on the front quarter
        if ((has(a, 'Limited Fire Arc') || dugIn(a)) && !inFireArc(a, t)) return false;
      }
      var d = unitDist(a, t);
      var range = opts.aux ? 12 : shotRange(a);
      if (d > range) return false;
      // Cloaking System (p. 129): nobody draws a bead on it from further than 12"
      if (has(t, 'Cloaking System') && d > 12) return false;
      var minR = shotMinRange(a);
      if (!opts.aux && minR && d < minR) return false;
      // Cumbersome Weapons cannot be fired from shallow water, nor on the turn the
      // crew stepped off a vehicle
      if (!opts.aux && has(a, 'Cumbersome Weapon') &&
        (kindsUnder(state, a).some(function (k) { return !!TERRAIN[k].shallow; }) || a.disembarked)) return false;
      // a dug-in gun is laying over its sights, so it needs to see what it hits
      if (!opts.aux && markCall(state, a, t, opts) === 'designate') return true;
      /* Limited Senses and Mental Projection (p. 129): a Xenotripod sees 12", but
         whatever one of the tribe sees, all of them see. An aircraft is over
         everything; Indirect Fire lobs over whatever is in the way. */
      var senses = xenoSenses(a) && !campFlag(a, 'banished');
      if (isFlying(a) || isFlying(t)) {                  // aircraft shoot and are shot over everything
        return !xenoSenses(a) || unitDist(a, t) <= sightRange(a) || (senses && tribeSees(state, a.side, t));
      }
      if (hasLoS(state, a, t)) return true;
      if (!senses || !tribeSees(state, a.side, t)) return false;
      if (!opts.aux && has(a, 'Indirect Fire')) return true;
      return lineClear(state, a, t);
    }

    /* A live Markerlight call (p. 58). The mark is not a condition the target wears
       for the rest of the turn: it exists only for the one or two units the marker
       calls up, and what it is worth depends on which of the two actions was used.

         Designate target — feeds units with Indirect Fire, which may then shoot
                            without line of sight (the target must still be in range).
         Mark the target  — feeds units WITHOUT Indirect Fire, which must have the
                            target in sight and in range, and fire as though it were
                            within half of theirs.

       `opts.markKind` asks the question hypothetically — could this unit answer a
       call of that kind — which is how the action bar decides what to offer. */
    function markCall(state, a, t, opts) {
      var kind = (opts && opts.markKind) || null;
      if (!kind) {
        var m = state && state.mark;
        if (!m || !t || m.side !== a.side) return null;
        if (m.targets.indexOf(t) < 0) return null;
        kind = m.kind;
      }
      if (kind === 'designate') return has(a, 'Indirect Fire') && !dugIn(a) ? 'designate' : null;
      return has(a, 'Indirect Fire') ? null : 'mark';
    }

    /* The auxiliary weapon as a shooter: the unit where it stands, with none of its
       special rules — so no Gauss or Anti-tank against the target's armour or cover,
       no Keen-Eyed against Stealth, no Indirect Fire over a wall. */
    var AUX_RANGE = 12;
    function auxGun(a) { return Object.assign({}, a, { rules: [], cargo: [], camp: null, fp: 1, range: AUX_RANGE }); }

    /* Every modifier on a shot except the die, in one place, so the odds shown on the
       board and the roll that follows can never drift apart. */
    function shotMods(state, a, t, mode, opts) {
      opts = opts || {};
      var aux = !!opts.aux;
      // a piece of terrain as the target (p. 57): only what the shooter brings counts
      var atT = !!opts.terrain;
      var basic = mode === 'defensive' || mode === 'basic' ||
        (has(a, 'Always Basic Firepower') && !aux) || (has(a, 'Indirect Fire') && !aux && !dugIn(a) && !dualMode(state, a, t)) ||
        isFlying(a) || isFlying(t) ||                    // aircraft shoot, and are shot at, basic
        flyInf(a) || flyInf(t);                          // and so do Flying Infantry (p. 116)
      var parts = [], total = 0;

      var fp = aux ? 1 : a.fp;
      total += fp; parts.push({ label: aux ? 'Auxiliary FP' : 'Firepower', v: fp });
      var phero = aux || atT ? 0 : pheromoneBonus(state, a, t);
      if (phero) { total += phero; parts.push({ label: 'Pheromone Markers', v: phero }); }
      var sb = sizeBonus(a.models);
      if (sb) { total += sb; parts.push({ label: a.models + ' models', v: sb }); }

      var dist = unitDist(a, t), crossfire = false, arc = 'front';
      // Anti-tank and Anti-aircraft bear even when firing basic
      var pierce = false;
      if (!aux) {
        if (t.cls === 'vehicle' && antiTank(a, dist)) {
          total += 4; parts.push({ label: 'Anti-tank', v: 4 }); pierce = true;
        }
        // Temporal Armour Amplifier (a Xenotripod aircraft upgrade, p. 143): immune to it
        if (isFlying(t) && has(a, 'Anti-aircraft') && !campFlag(t, 'temporal')) {
          total += 4; parts.push({ label: 'Anti-aircraft', v: 4 }); pierce = true;
        }
        // a Gauss weapon punches harder through a hull
        if (t.cls === 'vehicle' && has(a, 'Gauss Weapon')) {
          total += 1; parts.push({ label: 'Gauss Weapon', v: 1 });
        }
      }
      /* A hull's flanks are softer to anything, the auxiliary weapon included — but
         Basic Firepower counts nothing beyond Firepower and models (p. 32). */
      if (t.cls === 'vehicle' && !has(t, 'Advanced Protection') && !basic) {
        arc = arcOf(t, a);
        var tp = propOf(t);
        if (arc === 'side' && !(tp && tp.noSideArc)) { total += 1; parts.push({ label: 'side armour', v: 1 }); }
        else if (arc === 'rear') { total += 2; parts.push({ label: 'rear armour', v: 2 }); }
      }
      // Spotters (an Adaptation, p. 125): +1 for every friendly unit within 6", up to +3
      if (!aux && campFlag(a, 'spotters') && state && state.units) {
        var near6 = state.units.filter(function (o) {
          return o !== a && o.alive && !o.aboard && o.side === a.side && unitDist(o, a) <= 6;
        }).length;
        if (near6) { total += Math.min(3, near6); parts.push({ label: 'Spotters', v: Math.min(3, near6) }); }
      }
      /* The auxiliary weapon (p. 32) fires "without ANY special rules" — its own
         or the unit's — but the ordinary modifiers of a shot still apply to it:
         standing still, half range, height, Crossfire, and the target's cover. */
      if (!basic) {
        // Effective Toxin Glands: Spore and Flying Bugs get +2 for Fire! (p. 124)
        var toxin = !aux && bugRanged(a) && doctrine(state, a.side, 'BC6');
        // ...and so does a Xenotripod unit with the Rite of Perfection (p. 142)
        var perfect = !aux && campFlag(a, 'perfection');
        var fireB = mode === 'fire' && (toxin || perfect) ? 2 : 1;
        if (mode === 'fire') { total += fireB; parts.push({ label: fireB === 2 ? (perfect ? 'Fire! — Rite of Perfection' : 'Fire! — Effective Toxin Glands') : 'Fire! (stationary)', v: fireB }); }
        // Chaotic Ranged Attacks (a Genetic Flaw): no bonus inside half range
        var rng = aux ? AUX_RANGE : shotRange(a);
        if (dist <= Math.ceil(rng / 2) && !aux && campFlag(a, 'chaotic')) {
          parts.push({ label: 'Chaotic Ranged Attacks — no half-range bonus', v: 0 });
        } else if (dist <= Math.ceil(rng / 2)) {
          // Rain of Fire doubles the close-range bonus
          var close = !aux && campFlag(a, 'rainOfFire') ? 4 : 2;
          total += close;
          parts.push({ label: close === 4 ? 'Rain of Fire, within half range' : 'within half range', v: close });
        }
        else if (!aux && markCall(state, a, t, opts) === 'mark') {
          total += 2; parts.push({ label: 'Markerlight', v: 2 });
        }
        /* Height: +2 for firing down on a target standing lower — from a hill on
           to the level ground, and from the crown of a stepped hill on to its
           lower slope as well. Once, however many steps down it is. */
        var la = levelOf(state, a), lt = levelOf(state, t);
        if (la > lt) {
          total += 2;
          parts.push({ label: la === 2 && lt === 1 ? 'firing down from the crown of the hill' : 'firing from a hill', v: 2 });
        }
        // a good shooting position: a high building or a reinforced one (pp. 41, 43)
        if (a.bld && sectionHigh(a.bld, sectionRect(a))) {
          total += 2; parts.push({ label: a.bld.kind === 'bunker' ? 'firing from a reinforced building' : 'firing from a high building', v: 2 });
        }
        /* Troops inside buildings, and in trenches, are not affected by Crossfire
           (pp. 41-42). */
        // immune only with the whole unit in the trench (p. 42)
        var noX = !!t.bld || kindsUnder(state, t).every(function (k) { return !!TERRAIN[k].noCrossfire; });
        for (var i = 0; i < t.shotFrom.length && !isMachine(t) && !noX; i++) {
          var p = t.shotFrom[i];
          if (p.basic) continue;
          // Crossfire: the target sits between this firer and an earlier one
          if (pointSegDist(t.x, t.y, p.x, p.y, a.x, a.y) < UNIT_R * 1.6) { crossfire = true; break; }
        }
        if (crossfire) { total += 2; parts.push({ label: 'Crossfire', v: 2 }); }
        // Zero-in: every later attack on a target already shot at this turn
        if (t.shotFrom.length && doctrine(state, a.side, 'T6')) {
          total += 1; parts.push({ label: 'Zero-in', v: 1 });
        }
      }
      // Demolisher: a machine fitted for knocking buildings down
      if (!aux && !atT && campFlag(a, 'demolisher') && shelterOf(state, a, t)) {
        total += 4; parts.push({ label: 'Demolisher', v: 4 });
      }
      // a unit charging home cannot claim cover from the defensive fire it draws
      var dres = atT ? null : defenceAgainst(state, aux ? auxGun(a) : a, t,
        { noCover: mode === 'defensive', defensiveFire: mode === 'defensive' });
      return {
        total: total, parts: parts, basic: basic, aux: aux, pierce: pierce,
        crossfire: crossfire, arc: arc, dist: dist, def: dres
      };
    }

    /* The exact chance of the shot telling, by walking all ten faces of the die:
       an unmodified 0 always fails and an unmodified 9 always scores at least one hit. */
    function shotOdds(state, a, t, mode, opts) {
      var m = shotMods(state, a, t, mode, opts);
      var tell = 0, sum = 0;
      for (var r = 0; r <= 9; r++) {
        var h = r === 0 ? 0 : r === 9 ? Math.max(1, r + m.total - m.def.value)
          : Math.max(0, r + m.total - m.def.value);
        if (h > 0) tell++;
        sum += h;
      }
      return {
        chance: tell / 10, avgHits: sum / 10, mods: m.total, def: m.def.value,
        need: Math.max(1, m.def.value - m.total + 1), parts: m.parts, defParts: m.def.parts
      };
    }

    function shoot(state, a, t, mode, opts) {
      opts = opts || {};
      /* A squad or a gun on its trails turns onto what it fires at. Only a
         machine's facing is ever read by the rules (Limited Fire Arc, which side
         is hit), so for anyone else this only turns the drawing. */
      /* A crew-served piece lays its weapon on the target (`aim`, the exact
         bearing, traversed like a turret); its mount turns only to the nearest of
         the eight facings. A dug-in gun "cannot be turned" (p. 94): its mount
         stays put and it traverses within its front arc. Nothing in the rules
         reads a squad's facing; this is how it is drawn. */
      if (a && t && !isMachine(a) && a.x != null && !(opts && opts.assault)) {
        a._turnFrom = { f: a.facing, a: a.aim };          // where it pointed, so the swing can be played
        a.aim = Math.atan2(t.y - a.y, t.x - a.x);
        if (!dugIn(a)) a.facing = nearestFacing(a.aim);
      }
      var m = shotMods(state, a, t, mode, opts);
      var aux = m.aux, basic = m.basic, parts = m.parts.slice(), pierce = m.pierce;
      var crossfire = m.crossfire, dist = m.dist, dres = m.def;
      var log = [];
      var roll = d10();
      var total = m.total + roll;
      parts.unshift({ label: 'D10', v: roll });
      /* Rite of Concentration (p. 142): once a battle the unit "may double its D10".
         A player calls for it on the shot (opts.concentrate); the AI spends it on
         its first roll where doubling is worth having. The unmodified 0 and 9 are
         still read off the die itself. */
      var riteLeft = !aux && campFlag(a, 'concentration') && a.camp && a.camp.once && !a.camp.once.concentration;
      var aiSide = state && state.cfg && (state.cfg.aiSides || []).indexOf(a.side) >= 0;
      var wantRite = opts.concentrate != null ? !!opts.concentrate : aiSide && roll >= 5;
      if (riteLeft && wantRite && roll > 0 && roll < 9) {
        a.camp.once.concentration = true;
        total += roll;
        parts.splice(1, 0, { label: 'Rite of Concentration — D10 doubled', v: roll });
      }
      // a Basic Firepower attack is "not counted for Crossfire in any way" (p. 32)
      t.shotFrom.push({ x: a.x, y: a.y, basic: !!basic });

      /* Destructive Weapon (p. 57): a final 15+ or an unmodified 9 against a target
         sheltering in a destructible piece brings it down, strips the cover from
         this very attack, and makes the hits bite one step harder. */
      var breach = null;
      if (!aux && (roll === 9 || total >= 15)) {
        var shelter = shelterOf(state, a, t);
        if (shelter && canDemolish(a, shelter)) {
          breach = shelter;
          dres = defenceAgainst(state, a, t, { noCover: true });
        }
      }

      var hits;
      if (roll === 0) hits = 0;
      else if (roll === 9) hits = Math.max(1, total - dres.value);
      else hits = Math.max(0, total - dres.value);

      log.push({
        t: 'shoot',
        text: a.label + (aux ? ' (auxiliary weapons)' : '') + (basic && !aux ? ' (Basic Firepower)' : '') +
          ' fires at ' + t.label + ' at ' + dist.toFixed(1) + '"' +
          (breach ? ' — and the ' + TERRAIN[breach.kind].name.toLowerCase() + ' comes apart' : ''),
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' vs Defence ' + dres.value +
          ' [' + dres.parts.map(function (p) { return p.label + ' ' + p.v; }).join(', ') + '] → ' +
          hits + ' hit' + (hits === 1 ? '' : 's')
      });
      var wreck = breach ? destroyTerrain(state, breach, log, a) : null;

      if (hits > 0 && isMachine(t)) {
        var dres2 = resolveDamage(t, hits, pierce, dmgMod(state, a, t));
        log.push({ t: 'hits', text: dres2.rolls.join(' · ') });
        applyDamage(state, t, dres2.damage, log, a);
        return { log: log, hits: hits, wreck: wreck };
      }
      var medicId = null;
      if (hits > 0) {
        var mod = 0;
        /* Undisciplined (p. 94): shooting at a Broken Rebel unit, or catching one in
           a crossfire, is worth +2 on the hit table rather than the usual +1. */
        var loose = undisciplined(t);
        if (status(t) === 'broken') mod += loose ? 2 : 1;
        if (crossfire) mod += loose ? 2 : 1;
        if (breach) mod += 1;
        // a solitaire scenario may make the OpFor easier to hurt (Protecting the VIP, p. 151)
        mod += dmgMod(state, a, t);
        var res = resolveShootingHits(state, t, hits, mod, a, true);
        medicId = res.medic || null;
        // Incendiary doubles the suppression of the attack itself, before any
        // extra points that special rules add
        var burn = '';
        // Nerves of Steel, and the Rite of Shielding (p. 142), shrug off the extra points
        var steady = campFlag(t, 'nerves') || campFlag(t, 'shielding');
        if (has(a, 'Incendiary Ammunition') && !aux && !has(t, 'Battle Armour') && !steady) {
          // "in any area terrain other than open terrain or shallow water" (Incendiary Ammunition) — any
          // part of it being, the worst for it (p. 42)
          var tk = kindsUnder(state, t).filter(function (k) { return k !== 'open' && !TERRAIN[k].shallow && !TERRAIN[k].linear; })[0];
          if (tk) {
            res.sp *= 2;
            burn = ' · Incendiary Ammunition: suppression doubled in ' + TERRAIN[tk].name.toLowerCase();
          }
        }
        // Suppressive Fire (p. 59): any successful attack, Basic Firepower included —
        // the auxiliary weapon alone carries no special rules
        var supp = has(a, 'Suppressive Fire') && !aux && !steady;
        if (supp) res.sp += 2;
        // a horse shies whenever it is shot at: one more Suppression point (Appendix 3)
        var mtS = mountOf(t);
        if (mtS && mtS.shotSP && !steady) { res.sp += mtS.shotSP; res.notes.push('Horse +' + mtS.shotSP + ' SP'); }
        // Highly Irritating Venom: a Spore or Flying Bug's suppression bites one more (p. 124)
        if (res.sp > 0 && !aux && bugRanged(a) && doctrine(state, a.side, 'BC4') && !campFlag(t, 'shielding')) {
          res.sp += 1; res.notes.push('Highly Irritating Venom +1 SP');
        }
        // Brave and Courage Under Fire, off the attack's whole count (p. 88)
        shotRelief(state, t, res);
        log.push({ t: 'hits', text: res.rolls.join(' · ') + burn + (supp ? ' · Suppressive Fire +2 SP' : '') +
          (res.notes.length ? ' · ' + res.notes.join(' · ') : '') });
        applyResult(state, t, res, log, a);
      } else if (mountOf(t) && mountOf(t).shotSP && !campFlag(t, 'nerves') && !campFlag(t, 'shielding')) {
        // a horse shies at being shot at, hit or not (Appendix 3)
        applyResult(state, t, { casualties: 0, sp: mountOf(t).shotSP, rolls: [], notes: [] }, log, a);
        log.push({ t: 'hits', text: 'Horses shy under fire: +' + mountOf(t).shotSP + ' SP' });
      }
      // who answered a MEDIC! on this volley, so the board can show them at work
      var out = medicId ? { log: log, hits: hits, medic: medicId } : { log: log, hits: hits };
      if (wreck) out.wreck = wreck;                     // what the shot brought down, for the board to repaint
      return out;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R; angleWrap = L.angleWrap; antiTank = L.antiTank;
      applyDamage = L.applyDamage; applyResult = L.applyResult; arcOf = L.arcOf; bugRanged = L.bugRanged;
      campFlag = L.campFlag; canDemolish = L.canDemolish; centreDist = L.centreDist; d10 = L.d10;
      defenceAgainst = L.defenceAgainst; destroyTerrain = L.destroyTerrain; dmgMod = L.dmgMod;
      doctrine = L.doctrine; dualMode = L.dualMode; flyInf = L.flyInf; fmtPart = L.fmtPart; has = L.has;
      hasLoS = L.hasLoS; hasOwn = L.hasOwn; inFireArc = L.inFireArc; isFlying = L.isFlying;
      isMachine = L.isMachine; kindsUnder = L.kindsUnder; levelOf = L.levelOf; lineClear = L.lineClear;
      mountOf = L.mountOf; pheromoneBonus = L.pheromoneBonus; pointSegDist = L.pointSegDist;
      propOf = L.propOf; resolveDamage = L.resolveDamage; resolveShootingHits = L.resolveShootingHits; shotRelief = L.shotRelief;
      ruleValue = L.ruleValue; sectionHigh = L.sectionHigh; sectionRect = L.sectionRect;
      shelterOf = L.shelterOf; sightRange = L.sightRange; sizeBonus = L.sizeBonus; status = L.status;
      tribeSees = L.tribeSees; undisciplined = L.undisciplined; unitDist = L.unitDist;
      xenoSenses = L.xenoSenses;
    }

    return {
      relink: relink,
      nearestFacing: nearestFacing, dugIn: dugIn, sandbagged: sandbagged, shotRange: shotRange,
      shotMinRange: shotMinRange, canShoot: canShoot, markCall: markCall, shotMods: shotMods,
      shotOdds: shotOdds, shoot: shoot
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCShoot;
})(typeof window !== 'undefined' ? window : global);
