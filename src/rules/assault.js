/* PMC 2670 — Firefight : assault: charges, close combat and falling back

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCAssault = function (E) {
    var BOARD = E.BOARD, BY_KEY = E.BY_KEY, STEP = E.STEP, TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R,
        applyDamage = E.applyDamage, applyResult = E.applyResult, bugGround = E.bugGround,
        campFlag = E.campFlag, canShoot = E.canShoot, clampTo = E.clampTo, d10 = E.d10, d3 = E.d3, d6 = E.d6,
        deathOrGlory = E.deathOrGlory, defenceAgainst = E.defenceAgainst, destroyTerrain = E.destroyTerrain,
        destructibleKind = E.destructibleKind, dmgMod = E.dmgMod, doctrine = E.doctrine, drives = E.drives,
        enterBuilding = E.enterBuilding, enterable = E.enterable, field = E.field, flyInf = E.flyInf,
        fmtPart = E.fmtPart, has = E.has, hasOwn = E.hasOwn, isDestructible = E.isDestructible,
        isFlying = E.isFlying, isMachine = E.isMachine, isOvergrown = E.isOvergrown, jumps = E.jumps,
        leaveAway = E.leaveAway, occupant = E.occupant, pathTo = E.pathTo, pheromoneBonus = E.pheromoneBonus,
        reachable = E.reachable, rectPointDist = E.rectPointDist, resolveAssaultHits = E.resolveAssaultHits,
        resolveDamage = E.resolveDamage, sectionRect = E.sectionRect, shelterOf = E.shelterOf,
        shoot = E.shoot, sizeBonus = E.sizeBonus, status = E.status, terrainAt = E.terrainAt,
        unitDist = E.unitDist, unitNear = E.unitNear;
    /* ---------- assault ---------- */
    // Vehicles and aircraft never charge; nothing can charge an aircraft.
    function canAssault(a, t) {
      // Overgrown bugs follow vehicle and aircraft rules, but may still assault (p. 116)
      if (isMachine(a) && !isOvergrown(a)) return false;
      // an Assault of "-" (the Carrier bug's, p. 123) is no Assault at all, as a "-" Firepower is no shooting
      if (!a.assault) return false;
      // only Flying Infantry may assault aircraft, or other Flying Infantry
      if ((isFlying(t) || flyInf(t)) && !flyInf(a)) return false;
      // Cloaking System: charged only from 12" or closer
      if (has(t, 'Cloaking System') && a.x != null && t.x != null && unitDist(a, t) > 12) return false;
      // a Turret never leaves its pad
      if (hasOwn(a, 'Turret')) return false;
      return true;
    }

    /* How a charge gets there (p. 33): "the maximum distance between them is the
       attacker's Movement + 2"... The assaulting unit moves in the shortest and
       simplest way possible, with its movement reduced by terrain as normal." So
       reach is walked over the ground, round what cannot be crossed and paying for
       what slows it, not measured through a wall. The walk stops 1" short of the
       enemy like any move; the last step into contact is the straight gap left.
       Flyers, jump troops and anything fighting from inside a building keep the
       straight line. An Overgrown bug on the ground drives there as a hull does
       (p. 116), round the buildings it cannot enter and paying for its turns.
       Returns a function giving, for a target, { cost, path } — or null when
       the charge cannot reach it. */
    function chargeReach(state, a, allowance) {
      // a unit not on the table (in reserve, or aboard a transport) cannot charge anything from there
      if (a.x < 0 || a.y < 0 || a.aboard) return function () { return null; };
      var straight = a.bld || isFlying(a) || flyInf(a) || jumps(a);
      var f = straight ? null : drives(a) ? { seen: reachable(state, a, allowance).map(function (p) {
        return { i: Math.round(p.x / STEP), j: Math.round(p.y / STEP), c: p.spent };
      }) } : field(state, a, allowance);
      /* A scenario's bounds on where a unit may go hold for a charge as for any
         move (pp. 151, 154): the OpFor may not charge into Evacuation's safe zone,
         nor the commando out past Protecting the VIP's 12". Judged where the charge
         ends, in contact. */
      var bound = state.scen && state.scen.moveOK;
      function allowed(t, fx, fy) {
        if (!bound || a.bld) return true;
        var c;
        if (t.bld) {
          var q = sectionRect(t);
          var cx = Math.max(q.x, Math.min(q.x + q.w, fx)), cy = Math.max(q.y, Math.min(q.y + q.h, fy));
          var ux = fx - cx, uy = fy - cy, ul = Math.hypot(ux, uy) || 1;
          c = { x: cx + ux / ul * (UNIT_R + 0.05), y: cy + uy / ul * (UNIT_R + 0.05) };
        } else {
          var v = Math.hypot(t.x - fx, t.y - fy) || 1;
          c = { x: t.x - (t.x - fx) / v * (2 * UNIT_R), y: t.y - (t.y - fy) / v * (2 * UNIT_R) };
        }
        return bound(state, a, c);
      }
      return function (t) {
        var gap0 = unitDist(a, t);
        if (straight) return gap0 <= allowance + 1e-6 && allowed(t, a.x, a.y) ? { cost: gap0, path: [{ x: a.x, y: a.y }] } : null;
        var q = t.bld ? sectionRect(t) : null, best = null;
        f.seen.forEach(function (n) {
          var x = n.i * STEP, y = n.j * STEP;
          var gap = q ? Math.max(0, rectPointDist(q, x, y) - UNIT_R) : Math.max(0, Math.hypot(t.x - x, t.y - y) - 2 * UNIT_R);
          if (gap > 1 + STEP * 1.5) return;               // only the last inch goes straight in
          var tot = n.c + gap;
          if (tot <= allowance + 1e-6 && (!best || tot < best.cost)) best = { cost: tot, x: x, y: y };
        });
        if (!best) return null;
        if (!allowed(t, best.cost - gap0 < 1e-6 ? a.x : best.x, best.cost - gap0 < 1e-6 ? a.y : best.y)) return null;
        var path = best.cost - gap0 < 1e-6 ? [{ x: a.x, y: a.y }] : pathTo(state, a, allowance, best);
        return { cost: best.cost, path: path };
      };
    }
    function chargeRoute(state, a, t, allowance) { return chargeReach(state, a, allowance)(t); }

    // Martyrdom (p. 112): Holy Warriors of a force on the Path of the Prophet, with a man to spare
    function canMartyr(state, u, foe) {
      if (!u || !foe || !foe.alive || !doctrine(state, u.side, 'P1')) return false;
      var p = BY_KEY[u.key];
      return !!p && p.group === 'Holy Warriors' && u.models > 1;
    }
    function assault(state, a, t, opts) {
      var log = [], wrecked = null;
      opts = opts || {};
      log.push({ t: 'assault', text: a.label + ' charges ' + t.label + ' — ' + unitDist(a, t).toFixed(1) + '" to contact.' });

      /* Martyrdom (Path of the Prophet, p. 113): before the first round is rolled,
         one of the Holy Warriors walks into the enemy and takes D3 of them with him.
         The unit takes no Suppression for the death. */
      function martyr(u, foe) {
        if (!canMartyr(state, u, foe)) return;
        /* "the Rebel commander may order" it (p. 112): a player says so as the
           assault begins (opts.martyr); the AI spends a man only while the unit
           has more than two to spare. */
        var say = opts.martyr && opts.martyr[u.side];
        if (say === false || (say == null && u.models <= 2)) return;
        u.models -= 1;
        var hits = d3();
        log.push({ t: 'assault', text: 'Martyrdom — one of ' + u.label + ' goes in alone. ' +
          hits + ' automatic hit' + (hits === 1 ? '' : 's') + ' on ' + foe.label + '.' });
        if (isMachine(foe)) {
          var dm = resolveDamage(foe, hits, false);
          log.push({ t: 'hits', text: dm.rolls.join(' · ') });
          applyDamage(state, foe, dm.damage, log, u);
        } else {
          var mr = resolveAssaultHits(foe, hits, 0, u);
          log.push({ t: 'hits', text: mr.rolls.join(' · ') });
          applyResult(state, foe, mr, log, u);
        }
      }

      /* "Death or Glory, Comrades!" (p. 94): the shout lands as the charge begins and
         every Suppression point goes with it. Defensive fire can still pin them. */
      var shout = a.sp ? deathOrGlory(state, a) : null;
      if (shout) {
        log.push({ t: 'rally', text: '"Death or Glory, Comrades!" — ' + shout.name + ' sends ' + a.label +
          ' in, and all ' + a.sp + ' Suppression falls away.' });
        a.sp = 0;
      }

      /* Defensive fire "is resolved immediately or as soon as the charging unit
         enters the range and LoS" (p. 33): so it is looked for all along the way
         in, and a charge that is stopped stops where it was shot. */
      var fireAt = null, fireAux = false;
      if (t.alive && status(t) === 'ready' && t.fp !== null) {
        var route = (opts.path || [{ x: a.x, y: a.y }]).slice();
        var x0 = a.x, y0 = a.y, walk = [];
        for (var wi = 0; wi < route.length; wi++) {
          var from = wi ? route[wi - 1] : { x: a.x, y: a.y }, to = route[wi];
          var len = Math.hypot(to.x - from.x, to.y - from.y), nstep = Math.max(1, Math.ceil(len / 0.5));
          for (var ws = wi ? 1 : 0; ws <= nstep; ws++) walk.push({ x: from.x + (to.x - from.x) * ws / nstep, y: from.y + (to.y - from.y) * ws / nstep });
        }
        // and the last straight run into contact
        var end = walk[walk.length - 1], cd = t.bld ? null : Math.hypot(t.x - end.x, t.y - end.y);
        if (cd && cd > 2 * UNIT_R) {
          var nIn = Math.ceil((cd - 2 * UNIT_R) / 0.5);
          for (var wk = 1; wk <= nIn; wk++) {
            var r0 = cd - (cd - 2 * UNIT_R) * wk / nIn;
            walk.push({ x: t.x - (t.x - end.x) / cd * r0, y: t.y - (t.y - end.y) / cd * r0 });
          }
        }
        /* With its main weapon, or — where that cannot bear (inside its Minimum
           Range, or a Specialisation the charger is not) — its Auxiliary weapons,
           which "can still be used against all targets" (pp. 57, 59). */
        for (var wp = 0; wp < walk.length && !fireAt; wp++) {
          if (!a.bld) { a.x = walk[wp].x; a.y = walk[wp].y; }
          if (unitDist(a, t) <= t.range && canShoot(state, t, a, 'defensive', {})) fireAt = walk[wp];
          else if (!isFlying(t) && canShoot(state, t, a, 'defensive', { aux: true })) { fireAt = walk[wp]; fireAux = true; }   // aircraft carry none (p. 32)
        }
        a.x = x0; a.y = y0;
      }
      if (fireAt) {
        if (!a.bld) { a.x = fireAt.x; a.y = fireAt.y; }
        var df = shoot(state, t, a, 'defensive', fireAux ? { aux: true } : {});
        df.log.forEach(function (l) { log.push(l); });
        if (!a.alive) return { log: log, ok: false, wreck: wrecked };
        var after = status(a);
        if (after !== 'ready') {
          log.push({ t: 'note', text: 'Defensive fire stops the charge — ' + a.label + ' is ' + after + ' and the assault fails.' });
          return { log: log, ok: false };
        }
      }

      /* Into base-to-base contact — against a garrison, up against its wall. A unit
         going at the next section of its own building stays where it is. */
      var held = t.bld ? { piece: t.bld, sec: t.sec || 0 } : null;
      /* ...from the end of the route it took, not along the straight line from
         where it began: that line may run through the building it went round. */
      var went = opts.path && opts.path.length ? opts.path[opts.path.length - 1] : null;
      if (went && !a.bld) { a.x = went.x; a.y = went.y; }
      if (a.bld) { /* already in contact, wall to wall */ }
      else if (held) {
        var q0 = sectionRect(t);
        var cx = clampTo(a.x, q0.x, q0.x + q0.w), cy = clampTo(a.y, q0.y, q0.y + q0.h);
        var ux = a.x - cx, uy = a.y - cy, ul = Math.hypot(ux, uy) || 1;
        a.x = cx + ux / ul * (UNIT_R + 0.05); a.y = cy + uy / ul * (UNIT_R + 0.05);
      } else {
        var v = Math.hypot(t.x - a.x, t.y - a.y) || 1;
        a.x = t.x - (t.x - a.x) / v * (2 * UNIT_R);
        a.y = t.y - (t.y - a.y) / v * (2 * UNIT_R);
      }

      martyr(a, t);
      if (!t.alive || !a.alive) return { log: log, ok: true, wreck: wrecked };
      martyr(t, a);
      if (!t.alive || !a.alive) return { log: log, ok: true, wreck: wrecked };

      var order = [{ atk: a, def: t }, { atk: t, def: a }];
      // ...but the enemy strikes first when those bugs are the ones charging
      if (bugGround(a) && doctrine(state, a.side, 'BP5')) {
        order.reverse();
        log.push({ t: 'note', text: 'Chitin Exoskeletons — ' + t.label + ' strikes first.' });
      }
      /* Three rounds each, taken in turn (p. 33): the attacker strikes, then the
         assaulted unit answers, and again, until one of them breaks or six rounds
         are done. A unit that is already Broken does not fight back at all — but
         the attacker's three rounds are still all resolved against it. */
      var ended = false, breachIn = -1;
      var cowed = status(t) === 'broken';
      if (cowed) log.push({ t: 'note', text: t.label + ' is broken and does not fight back.' });
      for (var r = 0; r < 3 && !ended; r++) {
        for (var o = 0; o < order.length && !ended; o++) {
          var pair = order[o];
          if (cowed && pair.atk === t) continue;
          if (!pair.atk.alive || !pair.def.alive) { ended = true; break; }
          var rd = assaultRound(state, pair.atk, pair.def, pair.atk === a ? 'attacker' : 'defender', r + 1,
            breachIn === r ? Object.assign({}, opts, { breachPlus: true }) : opts);
          if (rd.breached) breachIn = r;
          if (rd.wreck) wrecked = rd.wreck;
          rd.log.forEach(function (l) { log.push(l); });
          if (!pair.def.alive) { ended = true; break; }
          if (cowed) continue;                                  // it is already running: the blows keep coming
          if (status(pair.def) === 'broken') {
            log.push({ t: 'note', text: fallBack(state, pair.def, pair.atk, 2)
              ? pair.def.label + ' breaks and falls back 2" — the assault ends.'
              : pair.def.label + ' breaks, but stays where it is — the assault ends.' });
            ended = true; break;
          }
        }
      }
      if (cowed && !ended && t.alive) {
        log.push({ t: 'note', text: fallBack(state, t, a, 2) ? t.label + ' gives ground and falls back 2".' : t.label + ' cannot give ground, and stays where it is.' });
        ended = true;
      }
      if (!ended && a.alive && t.alive) {
        if (a.bld) log.push({ t: 'note', text: 'Neither side breaks — ' + a.label + ' holds its own section.' });
        else {
          fallBack(state, a, t, 2);
          log.push({ t: 'note', text: 'Neither side breaks — ' + a.label + ' falls back 2".' });
        }
      }
      /* "If the attackers win, they occupy the building and the defenders leave it
         and fall back 2"" (p. 41). */
      if (held && a.alive && status(a) !== 'broken' && (!t.alive || t.bld !== held.piece) &&
        enterable(held.piece) && !occupant(state, held.piece, held.sec)) {
        if (!t.alive && t.bld) { t.bld = null; t.sec = null; }
        /* only a unit that may garrison moves in: a Rider unit "cannot occupy a
           building" (p. 94), and an Overgrown bug goes by the vehicle rules — they
           clear it, and it stands empty */
        if (E.canGarrison(a)) {
          enterBuilding(state, a, held.piece, held.sec);
          log.push({ t: 'note', text: a.label + ' takes the building.' });
        } else log.push({ t: 'note', text: a.label + ' clears the building, but cannot occupy it: it stands empty.' });
      }
      a.frenzyOwed = 0; t.frenzyOwed = 0;
      // Rite of Calmness (p. 142): the unit that won the assault sheds all its Suppression
      var beaten = function (u) { return !u.alive || status(u) === 'broken'; };
      var victor = beaten(t) && !beaten(a) ? a : beaten(a) && !beaten(t) ? t : null;
      if (victor && victor.sp && campFlag(victor, 'calmness')) {
        log.push({ t: 'rally', text: 'Rite of Calmness — ' + victor.label + ' sheds all ' + victor.sp + ' SP.' });
        victor.sp = 0;
      }
      return { log: log, ok: true, wreck: wrecked };
    }

    /* Sappers go in against a wall or a building with demolition charges: +4 on the
       first round, and a final 15+ or an unmodified 9 blows the cover in, so the
       defender loses it for that round and the hits land one step harder. */
    // only a unit that is assaulting — never one defending (p. 58)
    function sappingAt(state, atk, def, n) {
      if (n !== 1 || !has(atk, 'Sappers') || isMachine(def)) return false;
      return !!shelterOf(state, atk, def);             // in or behind something they can blow in
    }
    // the charge bonus against a piece of terrain: Sappers +4, anyone else +2 and
    // only against the scenario objective (p. 54)
    function chargeBonus(u, r) {
      if (has(u, 'Sappers')) return 4;
      return destructibleKind(r) === 'target' ? 2 : 0;
    }

    /* Everything added to a round's D10, bar the die itself: one list for the roll
       and for the odds shown before the charge, so the two cannot disagree. */
    function assaultMods(state, atk, def, role, n, opts) {
      var parts = [], total = 0;
      total += atk.assault; parts.push({ label: 'Assault', v: atk.assault });
      if (doctrine(state, atk.side, 'T4')) { total += 1; parts.push({ label: 'Improved HTH Training', v: 1 }); }
      // Holy Fury (Path of the Prophet, p. 113): +2 in any assault, either way round
      if (doctrine(state, atk.side, 'P4')) { total += 2; parts.push({ label: 'Holy Fury', v: 2 }); }
      var sb = sizeBonus(atk.models);
      if (sb) { total += sb; parts.push({ label: atk.models + ' models', v: sb }); }
      if (isMachine(def) && (!isMachine(atk) || isOvergrown(atk)) && !has(def, 'Advanced Protection')) {
        total += 4; parts.push({ label: 'assaulting a vehicle', v: 4 });
      }
      var pheroA = pheromoneBonus(state, atk, def, true);
      if (pheroA) { total += pheroA; parts.push({ label: 'Pheromone Markers', v: pheroA }); }
      // Fierce Attacks: Flying Infantry +4 in the first round (p. 124)
      if (n === 1 && flyInf(atk) && doctrine(state, atk.side, 'BB4')) { total += 4; parts.push({ label: 'Fierce Attacks', v: 4 }); }
      // Metal-covered Talons: +2 against vehicles (p. 124)
      if (isMachine(def) && doctrine(state, atk.side, 'BP6')) { total += 2; parts.push({ label: 'Metal-covered Talons', v: 2 }); }
      /* The Sappers' charges go in with the attacker only, and "the player may order
         them to perform a standard Assault action" instead (p. 59): then no +4. */
      var sapping = role === 'attacker' && !(opts && opts.noSap) && sappingAt(state, atk, def, n);
      if (sapping) { total += 4; parts.push({ label: 'Sappers', v: 4 }); }
      return { total: total, parts: parts, sapping: sapping };
    }
    // the odds of the charge's first round, as the attacker will roll it
    function assaultOdds(state, atk, def, opts) {
      var total = assaultMods(state, atk, def, 'attacker', 1, opts).total;
      var dres = defenceAgainst(state, atk, def, { assault: true });
      var tell = 0, sum = 0;
      for (var r = 0; r <= 9; r++) {
        var h = r === 0 ? 0 : r === 9 ? Math.max(1, r + total - dres.value)
          : Math.max(0, r + total - dres.value);
        if (h > 0) tell++;
        sum += h;
      }
      return { chance: tell / 10, avgHits: sum / 10, mods: total, def: dres.value,
        need: Math.max(1, dres.value - total + 1) };
    }

    function assaultRound(state, atk, def, role, n, opts) {
      var log = [];
      var roll = d10();
      var am = assaultMods(state, atk, def, role, n, opts);
      var parts = [{ label: 'D10', v: roll }].concat(am.parts), total = roll + am.total;
      var sapping = am.sapping;
      var breached = sapping && (roll === 9 || total >= 15);
      /* the cover blown in: "players add +1 to all rolls when resolving hits in that
         round of Assault" (p. 59) — the Sappers', and the defenders' answer too */
      var plusHit = breached || (opts && opts.breachPlus) ? 1 : 0;
      var wreck = null;
      if (breached) {
        var piece = shelterOf(state, atk, def);
        if (piece && isDestructible(piece)) wreck = destroyTerrain(state, piece, log, atk, def.bld === piece ? (def.sec || 0) : null);
      }
      var dres = defenceAgainst(state, atk, def, { assault: true });
      var hits;
      if (roll === 0) hits = 0;
      else if (roll === 9) hits = Math.max(1, total - dres.value);
      else hits = Math.max(0, total - dres.value);
      // Rite of Frenzy (p. 142): the hits owed for the fallen land with this round
      var owed = atk.frenzyOwed || 0;
      if (owed) { hits += owed; atk.frenzyOwed = 0; parts.push({ label: 'Rite of Frenzy — owed hits', v: owed }); }
      log.push({
        t: 'round', text: 'Round ' + n + ' — ' + atk.label + ' (' + role + ')' +
          (breached ? ' — charges blow the cover in!' : ''),
        math: parts.map(fmtPart).join(', ') + ' = ' + total + ' vs Defence ' + dres.value +
          ' → ' + hits + ' hit' + (hits === 1 ? '' : 's')
      });
      if (hits > 0 && isMachine(def)) {
        // a machine in close combat: 1 bounces, 2-3 a point, 4-6 D3
        var out = { damage: 0, rolls: [] }, vm = dmgMod(state, atk, def) + plusHit;
        for (var h = 0; h < hits; h++) {
          var r0 = d6(), r = Math.min(6, r0 + vm), tag;
          if (r === 1) tag = 'Bounced off the armour!';
          else if (r <= 3) { tag = 'Hull breached (1 DP)'; out.damage += 1; }
          else { var c = d3(); tag = 'Charge placed! (D3 ' + c + ' DP)'; out.damage += c; }
          out.rolls.push('D6 ' + r0 + (vm ? '+' + vm : '') + ' → ' + tag);
        }
        log.push({ t: 'hits', text: out.rolls.join(' · ') });
        applyDamage(state, def, out.damage, log, atk);
      } else if (hits > 0) {
        var res = resolveAssaultHits(def, hits, plusHit + dmgMod(state, atk, def), atk);
        log.push({ t: 'hits', text: res.rolls.join(' · ') +
          (res.notes.length ? ' · ' + res.notes.join(' · ') : '') });
        var fell = def.models;
        applyResult(state, def, res, log, atk);
        fell = Math.max(0, fell - def.models);
        /* Rite of Frenzy: for every one of them killed, D3-1 automatic hits on the
           enemy in the next round — unless the unit has broken. */
        if (fell && def.alive && campFlag(def, 'frenzy') && status(def) !== 'broken') {
          var fz = 0;
          for (var fi = 0; fi < fell; fi++) fz += d3() - 1;
          if (fz) { def.frenzyOwed = (def.frenzyOwed || 0) + fz; log.push({ t: 'note', text: 'Rite of Frenzy — ' + def.label + ' owes ' + fz + ' hit' + (fz > 1 ? 's' : '') + ' for its dead.' }); }
        }
      }
      /* What the swarm's campaign needs to know: which enemy units died in an
         assault, and which of those were human (Alternate Carbon-based Metabolism,
         Fungi Symbiosis, p. 124). */
      if (!def.alive && !def.fled) {
        atk.assaultKills = (atk.assaultKills || 0) + 1;
        /* human: a PMC or rebel unit of men — not a tribe's, not a hull or a turret,
           not a Drone unit (Fungi Symbiosis, p. 124: "every human unit") */
        var human = (def.faction === 'pmc' || def.faction === 'rebel' || !def.faction) &&
          !isMachine(def) && !has(def, 'Drone unit');
        if (human) atk.assaultKillsHuman = (atk.assaultKillsHuman || 0) + 1;
      }
      return { log: log, wreck: wreck, breached: !!breached };
    }

    function clampBoard(p) {
      p.x = Math.max(UNIT_R, Math.min(BOARD.w - UNIT_R, p.x));
      p.y = Math.max(UNIT_R, Math.min(BOARD.h - UNIT_R, p.y));
      return p;
    }

    /* Falling back `inch` inches straight away from `from`. Returns whether it moved.
       Broken artillery "do not retreat (they stay in place instead)" (p. 97), and
       nothing Immobile moves at all. A garrison "leave[s] it and fall[s] back 2""
       (p. 41): out through the far wall, its base ending no further than that from
       the building — the 2" is from the wall, not added to the way out. */
    function fallBack(state, u, from, inch) {
      if (hasOwn(u, 'Stationary Artillery') || hasOwn(u, 'Immobile')) return false;
      if (u.bld) { leaveAway(state, u, from, inch); return true; }
      var vx = u.x - from.x, vy = u.y - from.y, len = Math.hypot(vx, vy) || 1;
      for (var s = inch; s >= 0.5; s -= 0.5) {
        var p = clampBoard({ x: u.x + vx / len * s, y: u.y + vy / len * s });
        if (!TERRAIN[terrainAt(state, p.x, p.y)].impassable && !unitNear(state, p.x, p.y, u, 0.2)) {
          u.x = p.x; u.y = p.y; return true;
        }
      }
      return false;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      BOARD = L.BOARD; BY_KEY = L.BY_KEY; STEP = L.STEP; TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R;
      applyDamage = L.applyDamage; applyResult = L.applyResult; bugGround = L.bugGround;
      campFlag = L.campFlag; canShoot = L.canShoot; clampTo = L.clampTo; d10 = L.d10; d3 = L.d3; d6 = L.d6;
      deathOrGlory = L.deathOrGlory; defenceAgainst = L.defenceAgainst; destroyTerrain = L.destroyTerrain;
      destructibleKind = L.destructibleKind; dmgMod = L.dmgMod; doctrine = L.doctrine; drives = L.drives;
      enterBuilding = L.enterBuilding; enterable = L.enterable; field = L.field; flyInf = L.flyInf;
      fmtPart = L.fmtPart; has = L.has; hasOwn = L.hasOwn; isDestructible = L.isDestructible;
      isFlying = L.isFlying; isMachine = L.isMachine; isOvergrown = L.isOvergrown; jumps = L.jumps;
      leaveAway = L.leaveAway; occupant = L.occupant; pathTo = L.pathTo; pheromoneBonus = L.pheromoneBonus;
      reachable = L.reachable; rectPointDist = L.rectPointDist; resolveAssaultHits = L.resolveAssaultHits;
      resolveDamage = L.resolveDamage; sectionRect = L.sectionRect; shelterOf = L.shelterOf; shoot = L.shoot;
      sizeBonus = L.sizeBonus; status = L.status; terrainAt = L.terrainAt; unitDist = L.unitDist;
      unitNear = L.unitNear;
    }

    return {
      relink: relink,
      canAssault: canAssault, chargeReach: chargeReach, chargeRoute: chargeRoute, canMartyr: canMartyr,
      assault: assault, assaultOdds: assaultOdds, chargeBonus: chargeBonus, clampBoard: clampBoard, fallBack: fallBack
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCAssault;
})(typeof window !== 'undefined' ? window : global);
