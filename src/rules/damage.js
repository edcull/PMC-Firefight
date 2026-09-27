/* PMC 2670 — Firefight : hits and damage: hit tables, medics, vehicle damage, wrecks, repairs and hacking

   Made by rules.js as it loads, with E: the names of rules.js this needs,
   bound here once. Once every such file is made, rules.js hands each of them
   the others' functions themselves (relink), so a call from one to another
   goes straight there. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDamage = function (E) {
    var TERRAIN = E.TERRAIN, UNIT_R = E.UNIT_R, addSP = E.addSP, campFlag = E.campFlag,
        clampBoard = E.clampBoard, credit = E.credit, currentMorale = E.currentMorale, d3 = E.d3, d6 = E.d6,
        doctrine = E.doctrine, droneUnit = E.droneUnit, has = E.has, hasOwn = E.hasOwn,
        infamyPanic = E.infamyPanic, isFlying = E.isFlying, isMachine = E.isMachine, projects = E.projects,
        psychicBond = E.psychicBond, shoot = E.shoot, status = E.status, terrainAt = E.terrainAt,
        unitDist = E.unitDist, unitNear = E.unitNear;
    /* ---------- hit tables ---------- */
    /* Psychic Support (p. 130) counts as Field Medics — to 12" with Mind
       Amplifiers (p. 142). */
    function isMedic(u) { return has(u, 'Field Medics') || has(u, 'Psychic Support'); }
    function medicReach(state, u) { return has(u, 'Psychic Support') && doctrine(state, u.side, 'XT5') ? 12 : 6; }
    // the unit treating a squad's wounded: itself if it is the medics, else the nearest in reach
    function medicFor(state, target) {
      // the medic team treats its own wounded whatever state it is in (p. 57)
      if (isMedic(target)) return target;
      var best = null, bd = Infinity;
      for (var i = 0; i < state.units.length; i++) {
        var u = state.units[i], d;
        if (u.side === target.side && projects(u) && isMedic(u)
          && (d = unitDist(u, target)) <= medicReach(state, u) && d < bd) { best = u; bd = d; }
      }
      return best;
    }
    function medicNearby(state, target) { return !!medicFor(state, target); }

    function resolveShootingHits(state, target, hits, mod, atk) {
      var out = { casualties: 0, sp: 0, rolls: [], notes: [] };
      // "When resolving hits inflicted on a drone unit (both in shooting and assault), add 1 to the result" (p. 40)
      if (droneUnit(target)) { mod = (mod || 0) + 1; out.notes.push('Drone unit +1 to hit rolls'); }
      var medic = medicFor(state, target), medics = !!medic;
      var drugs = doctrine(state, target.side, 'T1');      // Combat Drugs
      var suicidal = campFlag(target, 'suicidal');         // Suicidal Tendencies
      for (var i = 0; i < hits; i++) {
        var raw = d6(), r = raw + mod, tag, down = false;
        if (suicidal) {
          // ignores hits on 1-2, but goes down on a 5-6
          if (r <= 2) tag = 'Steady, boys!';
          else if (r <= 4) { tag = 'Get down! (1 SP)'; out.sp += 1; }
          else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
        } else if (medics) {
          if (r <= 2) tag = 'Steady, boys!';
          else if (r <= 5) { tag = 'Get down! (1 SP)'; out.sp += 1; }
          else if (d6() === 6) { tag = 'MEDIC! casualty stabilised (1 SP)'; out.sp += 1; out.medic = medic.id; }
          // Combat Drugs stack with Field Medics (p. 87): the man the medic lost may still get up
          else if (drugs && d6() === 6) { tag = 'MEDIC! man down — Combat Drugs: he gets back up (1 SP)'; out.sp += 1; out.medic = medic.id; }
          else { tag = 'MEDIC! man down (1 SP)'; out.casualties += 1; out.sp += 1; out.medic = medic.id; }
        } else if (has(target, 'Animal Behaviour')) {
          // bugs: shrug it off or burst (p. 116)
          if (r <= 3) tag = 'QUEKKK! (ignored)';
          else { tag = 'SPLASH! (1 bug, 2 SP)'; down = true; }
        } else {
          if (r <= 1) tag = 'Steady, boys!';
          else if (r <= 5) { tag = 'Get down! (1 SP)'; out.sp += 1; }
          else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
        }
        if (down) {
          var saved = drugs && d6() === 6;
          // Adamantium Exoskeletons (an Adaptation): shrugs it off on a 5+
          var shell = !saved && campFlag(target, 'adamantium') && d6() >= 5;
          if (saved) { tag = 'Man down! — Combat Drugs: he gets back up (1 SP)'; out.sp += 1; }
          else if (shell) { tag += ' — Adamantium Exoskeletons: ignored'; }
          else { out.casualties += 1; out.sp += campFlag(target, 'overreact') ? 4 : 2; }
        }
        out.rolls.push('D6 ' + raw + (mod ? '+' + mod : '') + ' → ' + tag);
      }
      // Style Bonus on the firer: one more point of suppression per man killed
      if (atk && campFlag(atk, 'style') && out.casualties) {
        out.sp += out.casualties;
        out.notes.push('Style Bonus +' + out.casualties + ' SP');
      }
      // Brave shrugs one point off every ranged attack
      if (campFlag(target, 'brave') && out.sp > 0) { out.sp -= 1; out.notes.push('Brave -1 SP'); }
      // Courage Under Fire: the second and later attacks on a unit in the same turn
      if (target.shotFrom && target.shotFrom.length > 1 && doctrine(state, target.side, 'T2') && out.sp > 0) {
        out.sp -= 1; out.notes.push('Courage Under Fire -1 SP');
      }
      return out;
    }

    function resolveAssaultHits(target, hits, mod, atk) {
      mod = (mod || 0) + (droneUnit(target) ? 1 : 0);          // drone units, p. 40
      var out = { casualties: 0, sp: 0, rolls: [], notes: [] };
      var nbk = campFlag(atk, 'nbk');                     // Natural Born Killers
      for (var i = 0; i < hits; i++) {
        var raw = d6(), r = raw + mod, tag;
        var down = false;
        if (target && has(target, 'Animal Behaviour')) {
          if (r <= 3) tag = 'QUEKKK! (ignored)';
          else { tag = 'SPLASH! (1 bug, 2 SP)'; down = true; }
        } else if (nbk) {
          if (r <= 1) tag = 'Keep fighting!';
          else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
        } else if (r <= 1) tag = 'Keep fighting!';
        else if (r <= 3) { tag = 'Ouch! (1 SP)'; out.sp += 1; }
        else { tag = 'Man down! (1 model, 2 SP)'; down = true; }
        if (down) {
          if (campFlag(target, 'adamantium') && d6() >= 5) tag += ' — Adamantium Exoskeletons: ignored';
          else { out.casualties += 1; out.sp += campFlag(target, 'overreact') ? 4 : 2; }
        }
        out.rolls.push('D6 ' + raw + (mod ? '+' + mod : '') + ' → ' + tag);
      }
      if (nbk) out.notes.push('Natural Born Killers: down on a 2+');
      return out;
    }

    function applyResult(state, target, res, log, atk) {
      var before = status(target);
      if (target.minModels == null) target.minModels = target.models;
      addSP(target, res.sp);
      var lost = 0;
      for (var i = 0; i < res.casualties; i++) {
        target.models -= 1; lost++;
        if (target.models <= 0) { target.models = 0; target.alive = false; break; }
      }
      target.minModels = Math.min(target.minModels, target.models);
      if (lost) psychicBond(state, target, lost, log);
      if ((!target.alive || (status(target) === 'broken' && before !== 'broken'))) infamyPanic(state, target, log);
      if (!target.alive) {
        target.wipedOut = true;
        credit(target, atk, 'kill');
        log.push({ t: 'kill', text: target.label + ' is wiped out.' });
        return;
      }
      var after = status(target);
      if (after === 'broken') { target.brokenEver = true; credit(target, atk, 'broke'); }
      if (after !== before && after !== 'ready') {
        if (after === 'broken' && has(target, 'Expendable')) {
          target.alive = false;
          target.fled = true;                      // run off, not killed to the last man
          target.expended = true;                  // ...and not counted as a loss for victory (p. 57)
          log.push({ t: 'kill', text: target.label + ' breaks — Expendable: removed from play.' });
        } else {
          log.push({ t: after, text: target.label + ' is ' + after.toUpperCase() + ' (' + target.sp + ' SP vs Morale ' + currentMorale(target) + ').' });
        }
      }
    }

    /* ---------- vehicles and aircraft: damage, wrecks and repairs ---------- */
    // A hit on a machine: 1 bounces, 2-5 does a point, 6+ is a critical for D3 —
    // or D6 when the shot came from an Anti-tank or Anti-aircraft weapon.
    // what a scenario adds to every Damage roll against a side (Protecting the VIP: +2, p. 151)
    function dmgMod(state, a, t) {
      return state && state.scen && state.scen.hitMod && a && t ? (state.scen.hitMod(state, a, t) || 0) : 0;
    }
    function resolveDamage(target, hits, pierce, mod) {
      var out = { damage: 0, rolls: [] };
      mod = mod || 0;
      for (var i = 0; i < hits; i++) {
        var r0 = d6(), r = Math.min(6, r0 + mod), tag;
        if (r === 1) tag = 'Bounced off the armour!';
        else if (r <= 5) { tag = 'Target damaged! (1 DP)'; out.damage += 1; }
        else {
          var crit = pierce ? d6() : d3();
          tag = 'Critical hit! (' + (pierce ? 'D6 ' : 'D3 ') + crit + ' DP)';
          out.damage += crit;
        }
        out.rolls.push('D6 ' + r0 + (mod ? '+' + mod : '') + ' → ' + tag);
      }
      return out;
    }

    function applyDamage(state, t, damage, log, from) {
      t.damage = (t.damage || 0) + damage;
      if (t.damage <= t.str) {
        log.push({ t: 'note', text: t.label + ' takes ' + damage + ' damage (' + t.damage + ' of ' + t.str + ').' });
        return;
      }
      // knocked out: how badly depends on how far past its Structure it went
      var over = t.damage - t.str - 1;
      var bonus = over > 4 ? 2 : over > 2 ? 1 : 0;
      var roll = d6(), total = roll + bonus;
      t.alive = false;
      t.wipedOut = true;
      t.catastrophic = total > 5;
      // whatever became of it, a ground hull's wreck stays where it stood and blocks sight (p. 36)
      if (!isFlying(t)) t.wreckLoS = true;
      credit(t, from, 'kill');
      var crew = (t.cargo || []).slice();
      t.cargo = [];
      var how;
      if (isFlying(t)) {
        how = 'shot out of the sky';
        crew.forEach(function (u) {
          u.alive = false; u.models = 0; u.aboard = null;
          /* In a campaign a downed aircraft makes an emergency landing on a 4+ and
             "troops on-board survive, but get 5 TPs" (p. 86), so who was aboard
             which machine is recorded for the aftermath to read. */
          u.lostAboard = t.rid || t.id || true;
          log.push({ t: 'kill', text: u.label + ' goes down with the aircraft.' });
        });
        log.push({ t: 'kill', text: t.label + ' is destroyed — ' + how + '.' });
        return;
      }
      if (total <= 3) {
        how = 'Abandoned! The crew is out of the game';
        crew.forEach(function (u) {
          dropOff(state, t, u);
          addSP(u, d6());
          log.push({ t: 'note', text: u.label + ' bails out — ' + u.sp + ' SP.' });
        });
      } else if (total <= 5) {
        how = 'Vehicle on fire! The crew is lost';
        crew.forEach(function (u) {
          dropOff(state, t, u);
          var burn = shoot(state, { label: 'The burning ' + t.name, side: t.side, alive: true, models: 1, fp: 6, range: 48, rules: [], x: u.x, y: u.y, shotFrom: [], cls: 'infantry' }, u, 'basic', {});
          burn.log.forEach(function (l) { log.push(l); });
        });
      } else {
        how = 'Catastrophic explosion!';
        crew.forEach(function (u) {
          u.alive = false; u.models = 0; u.aboard = null;
          log.push({ t: 'kill', text: u.label + ' is destroyed inside the wreck.' });
        });
      }
      log.push({
        t: 'kill',
        text: t.label + ' is knocked out — D6 ' + roll + (bonus ? ' +' + bonus + ' overkill' : '') + ': ' + how,
        math: t.damage + ' damage against Structure ' + t.str
      });
      // only a catastrophic explosion catches the troops around the wreck (p. 36)
      if (total <= 5) return;
      var fp = 3 + t.tier;
      state.units.forEach(function (u) {
        if (!u.alive || u === t || isFlying(u) || u.aboard) return;
        if (unitDist(u, t) > 4) return;
        var blast = shoot(state, { label: 'The exploding ' + t.name, side: t.side === 'A' ? 'B' : 'A', alive: true, models: 1, fp: fp, range: 48, rules: [], x: t.x, y: t.y, shotFrom: [], cls: 'infantry' }, u, 'basic', {});
        blast.log.forEach(function (l) { log.push(l); });
      });
    }

    // put a passenger back on the table, as close to the vehicle as will fit
    function dropOff(state, veh, u) {
      u.aboard = null;
      for (var t = 0; t < 60; t++) {
        var ang = Math.random() * Math.PI * 2, d = 2 * UNIT_R + Math.random() * 2;
        var p = clampBoard({ x: veh.x + Math.cos(ang) * d, y: veh.y + Math.sin(ang) * d });
        if (TERRAIN[terrainAt(state, p.x, p.y)].impassable) continue;
        if (unitNear(state, p.x, p.y, u, 0.2)) continue;
        u.x = p.x; u.y = p.y;
        return true;
      }
      u.x = veh.x; u.y = veh.y;
      return false;
    }

    // Rally phase: a machine patches itself up. Jammers make it harder.
    function repair(state, u) {
      if (!u.damage) return null;
      // Nanobots (p. 89): the repair rolls dice for the whole Structure, not for what is left of it
      var dice = campFlag(u, 'nanobots') ? u.str : Math.max(1, u.str - u.damage), need = jammedNearby(state, u) ? 5 : 4;
      // Superior Self-repair System (p. 89): "can re-roll failed repair rolls. The second result stands."
      var reroll = campFlag(u, 'selfRepair');
      var rolls = [], fixed = 0;
      for (var i = 0; i < dice; i++) {
        var r = d6(), first = null;
        if (r < need && reroll) { first = r; r = d6(); }
        rolls.push({ value: r, first: first, ok: r >= need });
        if (r >= need) fixed++;
      }
      var before = u.damage;
      u.damage = Math.max(0, u.damage - fixed);
      return {
        dice: dice, need: need, rolls: rolls, fixed: fixed, before: before, after: u.damage, reroll: reroll,
        text: u.label + ' repairs: ' + dice + 'D6 [' + rolls.map(function (r) { return r.first != null ? r.first + '→' + r.value : r.value; }).join(' ') +
          '] on ' + need + '+' + (reroll ? ' (Superior Self-repair re-rolls)' : '') + ' — ' + fixed + ' damage cleared (' + before + ' → ' + u.damage + ').'
      };
    }
    /* Jammers: enemies within 24" rally — and repair — on 5+ instead of 4+.
       Counter-jamming within 6" of the victim shuts that out again. */
    /* Jammers is a penalty, so it bites from a unit that is suppressed or broken;
       Counter-jamming is a bonus, so it does not (p. 28). */
    function jammedNearby(state, u) {
      var jammed = false;
      for (var i = 0; i < state.units.length; i++) {
        var e = state.units[i];
        if (!e.alive || e.aboard || e.reserve || e.x < 0) continue;
        if (e.side !== u.side && has(e, 'Jammers') && unitDist(e, u) <= 24) jammed = true;
        if (e.side === u.side && projects(e) && has(e, 'Counter-jamming') && unitDist(e, u) <= 6) return false;
      }
      return jammed;
    }

    /* Hackers (p. 57): reach into an enemy drone within 24".
       1-2 nothing, 3-4 it is locked out for the turn and takes D3+1 hits,
       5-6 it is turned on its own side first, then takes the same hits. */
    function canHack(state, a, t) {
      if (!a.alive || !t.alive || a.side === t.side) return false;
      if (!has(a, 'Hackers') || !t.drone) return false;
      if (a.hackUsed) return false;
      return unitDist(a, t) <= 24;
    }

    function hack(state, a, t, fireBack) {
      var log = [], roll = d6();
      // a Xenotripod turret's systems are alien: a 5-6 only ever locks it out (p. 130)
      if (roll >= 5 && hasOwn(t, 'Turret')) {
        log.push({ t: 'note', text: 'Turret — the alien code will not turn: D6 ' + roll + ' counts as ' + (roll - 2) + '.' });
        roll -= 2;
      }
      a.hackUsed = true;
      var turned = false, locked = false;
      if (roll <= 2) {
        log.push({ t: 'note', text: a.label + ' tries to break into ' + t.label + ' — D6 ' + roll + ': the ice holds.' });
        return { log: log, roll: roll, turned: false, locked: false };
      }
      var hits = d3() + 1;
      /* 5-6: "the drone is activated immediately under control of the player who
         owns the hacking unit ... and afterwards suffers D3+1 hits". One that has
         already acted, or cannot act, counts as a 3-4 (p. 57). `fireBack` starts
         that activation and reports whether it could; the hits then wait for it. */
      var canAct = !t.activated && t.alive && status(t) !== 'broken';
      if (roll >= 5 && canAct && typeof fireBack === 'function') turned = !!fireBack(t, hits);
      if (turned) {
        log.push({ t: 'note', text: a.label + ' hacks ' + t.label + ' — D6 ' + roll + ': taken over for one activation, then burned for ' + hits + ' hits.' });
        return { log: log, roll: roll, turned: true, locked: false, hits: hits, pending: true };
      }
      locked = true;
      t.activated = true;
      t.hacked = true;
      log.push({
        t: 'note',
        text: a.label + ' hacks ' + t.label + ' — D6 ' + roll + (roll >= 5 ? ' (it cannot be activated, so as a 3-4)' : '') + ': locked out and burned for ' + hits + ' hits.'
      });
      hackBurn(state, a, t, hits, log);
      return { log: log, roll: roll, turned: false, locked: locked, hits: hits };
    }
    /* "...suffers D3+1 hits resolved like enemy fire" (p. 57): a hull takes them
       as damage; a Drone unit, which has no Structure, on the hit table like any
       squad (its +1 to those rolls included). */
    /* Expendable (p. 57): the collars go off the moment a penal unit is Broken,
       whatever broke it — a hit, a rite, a shout, a friend's melancholy. Returns
       the lines to log. */
    function collars(state) {
      var out = [];
      state.units.forEach(function (u) {
        if (!u.alive || u.aboard || !has(u, 'Expendable') || status(u) !== 'broken') return;
        u.alive = false; u.fled = true; u.expended = true;
        out.push({ t: 'kill', text: u.label + ' breaks — Expendable: the collars go off, removed from play.' });
      });
      return out;
    }
    function hackBurn(state, a, t, hits, log) {
      if (isMachine(t)) {
        var dres = resolveDamage(t, hits, false, dmgMod(state, a, t));
        log.push({ t: 'hits', text: dres.rolls.join(' · ') });
        applyDamage(state, t, dres.damage, log, a);
      } else {
        var hres = resolveShootingHits(state, t, hits, dmgMod(state, a, t), a);
        log.push({ t: 'hits', text: hres.rolls.join(' · ') });
        applyResult(state, t, hres, log, a);
      }
      return log;
    }

    /* Command Vehicle (p. 56): a Command Unit riding inside lends the hull all of
       its special rules, and may still act once the vehicle has finished. */
    function commandAboard(veh) {
      var cargo = veh && veh.cargo;
      if (!cargo || !has(veh, 'Command Vehicle')) return null;
      for (var i = 0; i < cargo.length; i++) if (has(cargo[i], 'Command Unit')) return cargo[i];
      return null;
    }

    // once every kit is made, the others' functions themselves rather than the stubs for them
    function relink(L) {
      TERRAIN = L.TERRAIN; UNIT_R = L.UNIT_R; addSP = L.addSP; campFlag = L.campFlag;
      clampBoard = L.clampBoard; credit = L.credit; currentMorale = L.currentMorale; d3 = L.d3; d6 = L.d6;
      doctrine = L.doctrine; droneUnit = L.droneUnit; has = L.has; hasOwn = L.hasOwn;
      infamyPanic = L.infamyPanic; isFlying = L.isFlying; isMachine = L.isMachine; projects = L.projects;
      psychicBond = L.psychicBond; shoot = L.shoot; status = L.status; terrainAt = L.terrainAt;
      unitDist = L.unitDist; unitNear = L.unitNear;
    }

    return {
      relink: relink,
      isMedic: isMedic, medicNearby: medicNearby, resolveShootingHits: resolveShootingHits,
      resolveAssaultHits: resolveAssaultHits, applyResult: applyResult, dmgMod: dmgMod,
      resolveDamage: resolveDamage, applyDamage: applyDamage, dropOff: dropOff, repair: repair,
      jammedNearby: jammedNearby, canHack: canHack, hack: hack, collars: collars, hackBurn: hackBurn,
      commandAboard: commandAboard
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDamage;
})(typeof window !== 'undefined' ? window : global);
