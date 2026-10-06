/* PMC 2670 — Firefight : the company: fielding an army, promotion, recruiting, disbanding and upgrades

   Made once by campaign.js, the first time it is wanted, with E: the names
   of campaign.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCCampCompany = function (E) {
    var COMPANY_COST = E.COMPANY_COST, R = E.R, RECRUIT_COST = E.RECRUIT_COST, addLoss = E.addLoss,
        availableHonours = E.availableHonours, availableUpgrades = E.availableUpgrades,
        byRid = E.byRid, canTakeHonour = E.canTakeHonour, canTakeUpgrade = E.canTakeUpgrade,
        commandKey = E.commandKey, fitCommand = E.fitCommand, hasDoctrine = E.hasDoctrine,
        honourTable = E.honourTable, isBugKey = E.isBugKey, isLeaderP = E.isLeaderP, isTurretP = E.isTurretP,
        isXenoKey = E.isXenoKey, massOf = E.massOf, money = E.money, newEntry = E.newEntry,
        poolOf = E.poolOf, profile = E.profile, promotionCost = E.promotionCost,
        ordinalName = E.ordinalName, isDefaultName = E.isDefaultName,
        promotionTargets = E.promotionTargets, upgradeTable = E.upgradeTable;

    /* ================= company legality and promotion ================= */
    /* Can this roster field a legal army at the given Battle Tier and Priority Level?
       Greedy: take the cheapest legal spread the composition table asks for. It only
       has to prove a legal army exists, so a greedy fill that respects the minima and
       the budget is enough — and it is what a player does at the table. */
    /* `available` restricts it to units not away being repaired — that matters for
       the contract screen, but not for the dossier questions (promotion, disbanding),
       where the book asks only whether the company *owns* a legal army. */
    /* Can this roster put a legal army on the table at this Battle Tier and Priority
       Level? The answer is built rather than guessed: fill each Tier's minimum from
       the books, then top up until `checkArmy` is satisfied. `fieldReport` is the
       same walk with its working shown, so the dossier can say what is missing
       rather than only that something is. */
    function fieldReport(co, battleTier, pl, available) {
      pl = pl || 1;
      var docs = co.doctrines || [];
      var avail = available
        ? co.roster.filter(function (e) { return !e.restUntil || e.restUntil <= 0; })
        : co.roster.slice();
      var comp = R.COMPOSITION[battleTier];
      if (!comp) return { ok: false, missing: [], fault: 'No such Battle Tier.' };
      var picked = [], pickedE = [], used = {};
      /* A unit of a kind already in the list goes in last: most of what caps a
         list is how many of one thing it holds (one turret unit, one of a core
         squad at this Level, so many aircraft), and a roster deep in one kind
         has others that fit. */
      function take(test) {
        var have = {};
        pickedE.forEach(function (e) { have[e.key] = (have[e.key] || 0) + 1; });
        var order = avail.filter(function (e) { return !used[e.rid]; })
          .sort(function (x, y) { return (have[x.key] || 0) - (have[y.key] || 0); });
        for (var i = 0; i < order.length; i++) {
          var e = order[i];
          if (!test(profile(e.key), e)) continue;
          used[e.rid] = 1; picked.push(R.entryPick(e)); pickedE.push(e);
          return true;
        }
        return false;
      }
      // the rules a list breaks by holding too much of something, rather than too little
      function capFaults(list) {
        return R.checkArmy(list, battleTier, pl, docs).faults.filter(function (f) { return /^(Max |At most |Only )/.test(f); }).length;
      }
      /* A unit of the Tier that does not take the list over one of its caps: a
         Tier the roster can only fill that way is short, and says so. */
      var capsAt = -1, capsNow = 0;           // the list's own count, worked out once for each length it reaches
      function ofTier(t) {
        return function (p, e) {
          if (p.tier !== t) return false;
          // a cap is on how many of a kind: with nothing like it in the list yet, it cannot be the one over
          var alike = pickedE.some(function (o) {
            var q = profile(o.key);
            return o.key === e.key || (q.group && q.group === p.group) || (q.cls === 'aircraft' && p.cls === 'aircraft');
          });
          if (!alike) return true;
          if (capsAt !== picked.length) { capsAt = picked.length; capsNow = capFaults(picked); }
          return capFaults(picked.concat([R.entryPick(e)])) <= capsNow;
        };
      }
      var missing = [];
      /* A swarm fights under one Leader Bug of the Battle Tier or higher (p. 114):
         the lowest one that qualifies goes in, and every other Leader Bug stays home. */
      if (co.faction === 'bugs') {
        var leaders = avail.filter(function (e) { var p = profile(e.key); return p && p.leaderBug; })
          .sort(function (x, y) { return profile(x.key).tier - profile(y.key).tier; });
        comp = R.compFor('bugs', battleTier);
        // the lowest that qualifies and that the composition table has room for
        var lead = leaders.filter(function (e) {
          var lt0 = profile(e.key).tier;
          return lt0 >= battleTier && comp.limits[lt0 - 1][1] > 0;
        })[0];
        leaders.forEach(function (e) { used[e.rid] = 1; });
        if (!lead) return { ok: false, missing: [], fault: 'Needs a Leader Bug of Tier ' + R.ROMAN[battleTier] + ' to lead a Tier ' + R.ROMAN[battleTier] + ' army.' };
        picked.push(R.entryPick(lead));
        var lt = profile(lead.key).tier;
        // the leader counts against its own Tier's minimum
        var credit = {}; credit[lt] = 1;
        for (var tb = 1; tb <= 5; tb++) {
          var needB = comp.limits[tb - 1][0] * pl - (credit[tb] || 0);
          var gotB = 0;
          for (var ib = 0; ib < needB; ib++) if (take(ofTier(tb))) gotB++;
          if (gotB < needB) missing.push({ tier: tb, short: needB - gotB });
        }
      } else
      // satisfy each Tier's minimum first, cheapest Tier last
      for (var t = 1; t <= 5; t++) {
        var need = comp.limits[t - 1][0] * pl;
        if (docs.indexOf('O2') >= 0 && t === battleTier) need = Math.ceil(need / 2);
        var got = 0;
        for (var i = 0; i < need; i++) if (take(ofTier(t))) got++;
        if (got < need) missing.push({ tier: t, short: need - got });
      }
      if (missing.length) {
        return {
          ok: false, missing: missing,
          fault: 'Needs ' + missing.map(function (m) {
            return m.short + ' more Tier ' + R.ROMAN[m.tier] + ' unit' + (m.short > 1 ? 's' : '');
          }).join(' and ') + '.'
        };
      }
      // then top up to something that passes every other rule
      for (var guard = 0; guard < 40; guard++) {
        var res = R.checkArmy(picked, battleTier, pl, docs);
        if (res.ok) return { ok: true, missing: [], fault: null };
        var added = take(function (p, e) {
          var trial = picked.concat([R.entryPick(e)]);
          var tr = R.checkArmy(trial, battleTier, pl, docs);
          // within the points, and breaking nothing the list did not already break
          return tr.spent <= comp.points * pl && tr.faults.length <= res.faults.length;
        });
        if (!added) break;
      }
      var last = R.checkArmy(picked, battleTier, pl, docs);
      /* Still breaking a rule: swap one unit at a time for one left at home of
         the same Tier, keeping any swap that leaves fewer faults, until it is
         legal or nothing helps. */
      for (var round = 0; round < 20 && !last.ok; round++) {
        var better = null;
        for (var pi = 0; pi < pickedE.length && !better; pi++) {
          var out = pickedE[pi], ot = profile(out.key).tier;
          for (var ai = 0; ai < avail.length; ai++) {
            var inn = avail[ai];
            if (used[inn.rid] || profile(inn.key).tier !== ot || inn.key === out.key) continue;
            var trial = picked.slice(); trial[pi] = R.entryPick(inn);
            var tr = R.checkArmy(trial, battleTier, pl, docs);
            if (tr.ok || tr.faults.length < last.faults.length) { better = { pi: pi, e: inn, pick: trial, res: tr }; break; }
          }
        }
        if (!better) break;
        delete used[pickedE[better.pi].rid]; used[better.e.rid] = 1;
        pickedE[better.pi] = better.e; picked = better.pick; last = better.res;
      }
      return { ok: last.ok, missing: [], fault: last.ok ? null : (last.faults[0] || 'No legal list.') };
    }
    function canFieldArmy(co, battleTier, pl, available) {
      return fieldReport(co, battleTier, pl, available).ok;
    }

    /* What still stands between this force and its next Tier (pp. 83-84), step by
       step, so the dossier can show how far along it is rather than only that it is
       not there yet. Every step carries what it wants and what the force has. */
    /* A swarm's free Leader Bug is promoted with the swarm (p. 124), and without it
       no army above the old Swarm Tier could ever be legal — so the promotion
       checks look at the roster as it will be, with the leader already grown. */
    function asPromoted(co, next) {
      if (co.faction !== 'bugs' || !co.cmdRid) return co;
      var trial = {}, k;
      for (k in co) trial[k] = co[k];
      trial.roster = co.roster.map(function (e) {
        if (e.rid !== co.cmdRid) return e;
        var c = {}; for (var k2 in e) c[k2] = e[k2];
        c.key = commandKey(co, next);
        return c;
      });
      return trial;
    }
    function promotionProgress(co) {
      if (co.tier >= 5) {
        return { top: true, next: null, cost: 0, ok: false, done: 0, total: 0, steps: [] };
      }
      var next = co.tier + 1, cost = COMPANY_COST[next];
      var steps = [{
        id: 'money', label: cost + ' ' + money(co) + ' banked',
        have: Math.min(co.kUC, cost), need: cost, done: co.kUC >= cost,
        detail: co.kUC >= cost ? 'Paid out of ' + co.kUC + ' in hand.'
          : (cost - co.kUC) + ' short of the ' + cost + ' it costs.'
      }];
      var probe = asPromoted(co, next);
      for (var t = 1; t <= next; t++) {
        var rep = fieldReport(probe, t, 1);
        steps.push({
          id: 'tier' + t, label: 'A legal Tier ' + R.ROMAN[t] + ' army',
          have: rep.ok ? 1 : 0, need: 1, done: rep.ok,
          detail: rep.ok ? 'The dossier can fill it.' : rep.fault
        });
      }
      // the standard-contract gate that stands before Tier IV (p. 84)
      if (next === 4) {
        var pl2 = fieldReport(probe, 3, 2);
        steps.push({
          id: 'pl2', label: 'A Tier III army at Priority Level 2',
          have: pl2.ok ? 1 : 0, need: 1, done: pl2.ok,
          detail: pl2.ok ? 'Twice the force, and still legal.'
            : 'Standard contracts at Tier IV are fought at this size. ' + pl2.fault
        });
      }
      var done = steps.filter(function (x) { return x.done; }).length;
      return {
        top: false, next: next, cost: cost, steps: steps,
        done: done, total: steps.length, ok: done === steps.length
      };
    }

    function canPromoteCompany(co) {
      if (co.tier >= 5) return { ok: false, why: 'Already a Tier V company.' };
      var next = co.tier + 1, cost = COMPANY_COST[next], faults = [];
      if (co.kUC < cost) {
        faults.push('Promotion to Tier ' + R.ROMAN[next] + ' costs ' + cost + ' ' + money(co) +
          ' — the force has ' + co.kUC + '.');
      }
      var probe = asPromoted(co, next);
      for (var t = 1; t <= next; t++) {
        if (!canFieldArmy(probe, t, 1)) faults.push('Cannot field a legal Tier ' + R.ROMAN[t] + ' army.');
      }
      // the standard contract gate before Tier IV
      if (next === 4 && !canFieldArmy(probe, 3, 2)) faults.push('Must be able to field a Tier III Priority Level 2 army to take standard contracts.');
      return { ok: !faults.length, cost: cost, next: next, faults: faults };
    }
    function promoteCompany(co) {
      var chk = canPromoteCompany(co);
      if (!chk.ok) return chk;
      co.kUC -= chk.cost;
      co.tier = chk.next;
      fitCommand(co);
      if (co.tier === 5) co.doctrineSwapAt = co.record.battles + 5;
      co.aspiring = false;
      return { ok: true, tier: co.tier, chooseDoctrine: true };
    }

    /* A company that could field one Tier higher may declare itself Aspiring (p. 84). */
    function canAspire(co) {
      return co.tier < 5 && !co.aspiring && canFieldArmy(co, co.tier + 1, 1);
    }
    function effectiveTier(co) { return co.tier + (co.aspiring ? 1 : 0); }

    /* ================= recruitment ================= */
    /* Penal troops are always free (four to an army, p. 57). Armed Civilians (p. 110),
       Tiny Bug Swarms (p. 124) and Primitive Epsilons cost nothing while the force has
       fewer than four of them; the fifth is paid for. Smuggler takes a point off
       everything else, down to a floor of one. */
    function recruitCost(co, key) {
      if (key === 'penal') return 0;
      if (key === 'rciv' || key === 'btiny' || key === 'xeps1') {
        var civs = co.roster.filter(function (e) { return e.key === key; }).length;
        if (civs < 4) return 0;
      }
      var p = profile(key), cost = RECRUIT_COST[p.tier];
      // a tribe's turrets and a company's drop pods are never bought, only fielded (pp. 86, 140)
      if (isTurretP(p) || p.noSlot) return 0;
      if (hasDoctrine(co, 'V1')) cost = Math.max(1, cost - 1);
      // Increased Population Growth: infantry below the Tribe Tier at half, rounding up
      if (hasDoctrine(co, 'XS1') && p.cls === 'infantry' && p.tier < co.tier) cost = Math.ceil(cost / 2);
      // Hermetic Society: every recruit costs double
      if (hasDoctrine(co, 'XS4')) cost *= 2;
      // Efficient Spawn Cycle: Lesser and Underground Bugs at two thirds, rounding up
      if (hasDoctrine(co, 'BP1') && /^(Lesser|Underground) Bugs$/.test(p.group)) cost = Math.ceil(cost * 2 / 3);
      return cost;
    }

    function canRecruit(co, key) {
      var p = profile(key);
      if (!p) return { ok: false, why: 'No such unit.' };
      if (p.faction !== (co.faction || 'pmc')) return { ok: false, why: 'A force recruits from its own list.' };
      if (p.tier > co.tier + 2) return { ok: false, why: 'A Tier ' + R.ROMAN[co.tier] + ' force may recruit up to Tier ' + R.ROMAN[Math.min(5, co.tier + 2)] + '.' };
      var cost = recruitCost(co, key);
      if (co.kUC < cost) return { ok: false, why: 'Costs ' + cost + ' ' + money(co) + ' — the force has ' + co.kUC + '.' };
      if (isLeaderP(p)) {
        var freeCmd = byRid(co, co.cmdRid);
        if (freeCmd && p.tier >= profile(freeCmd.key).tier) {
          return { ok: false, why: co.faction === 'rebel'
            ? 'Another First Among Equals must be of a lower Tier than the one who started the revolt.'
            : co.faction === 'bugs' ? 'Another Leader Bug must be of a lower Tier than the swarm\'s Overmind organism.'
            : co.faction === 'xeno' ? 'Another Alpha squad must be of a lower Tier than the tribe\'s own commanders.'
            : 'Additional Command Units must be of a lower Tier than the field command.' };
        }
      }
      return { ok: true, cost: cost };
    }
    function recruit(co, key, opts) {
      var chk = canRecruit(co, key);
      if (!chk.ok) return chk;
      co.kUC -= chk.cost;
      var e = newEntry(key, Object.assign({ co: co }, opts || {}));
      co.roster.push(e);
      return { ok: true, entry: e, cost: chk.cost };
    }
    function canDisband(co, entry) {
      if (entry.rid === co.cmdRid) return { ok: false, why: 'The field command cannot be disbanded.' };
      // the company as it would be, faction and doctrines and all: a swarm is judged on a swarm's table
      var trial = {};
      for (var k in co) trial[k] = co[k];
      trial.roster = co.roster.filter(function (e) { return e !== entry; });
      for (var t = 1; t <= co.tier; t++) {
        if (!canFieldArmy(trial, t, 1)) return { ok: false, why: 'Without it the company could not field a legal Tier ' + R.ROMAN[t] + ' army.' };
      }
      return { ok: true };
    }
    function disband(co, entry) {
      var chk = canDisband(co, entry);
      if (!chk.ok) return chk;
      co.roster = co.roster.filter(function (e) { return e !== entry; });
      addLoss(co, poolOf(profile(entry.key)), 'departed', massOf(entry, co));
      return { ok: true };
    }

    function promoteUnit(co, entry, newKey) {
      var targets = promotionTargets(entry, co);
      if (!targets.some(function (q) { return q.key === newKey; })) return { ok: false, why: 'Not a legal promotion for this unit.' };
      var cost = promotionCost(entry, newKey, co);
      if (entry.exp < cost.exp) return { ok: false, why: 'Needs ' + cost.exp + ' EXP, has ' + entry.exp + '.' };
      if (co.kUC < cost.kUC) return { ok: false, why: 'Needs ' + cost.kUC + ' ' + money(co) + ', the force has ' + co.kUC + '.' };
      var was = profile(entry.key).name;
      entry.exp -= cost.exp; co.kUC -= cost.kUC;
      // the rid, honours, traumas and history all stay; only the profile changes
      var renamed = isDefaultName(entry);
      var had = massOf(entry, co), hadPool = poolOf(profile(entry.key));
      entry.key = newKey;
      // a promotion to a smaller unit leaves the extra men behind
      addLoss(co, hadPool, 'departed', hadPool === poolOf(profile(newKey)) ? Math.max(0, had - massOf(entry, co)) : had);
      if (renamed) entry.name = ordinalName(co, newKey, entry);
      entry.history.push('Promoted from ' + was + ' to ' + profile(newKey).name + '.');
      return { ok: true, cost: cost };
    }

    function takeHonour(co, entry, honourN) {
      var chk = canTakeHonour(entry, co);
      if (!chk.ok) return chk;
      // never the same one twice, nor one this unit could not take (p. 88)
      if (!availableHonours(entry).some(function (h) { return h.n === honourN; })) return { ok: false, why: 'That one is not open to this unit.' };
      entry.exp -= chk.cost;
      var H = honourTable(entry.key);
      entry.honours.push(honourN);
      entry.history.push((isBugKey(entry.key) ? 'Adapted: ' : isXenoKey(entry.key) ? 'Performed the ' : 'Earned ') + H[honourN - 1].name + '.');
      return { ok: true, honour: H[honourN - 1], cost: chk.cost };
    }
    function takeUpgrade(co, entry, upgradeN) {
      var chk = canTakeUpgrade(entry);
      if (!chk.ok) return chk;
      // "no vehicle or aircraft can be given the same Upgrade twice", and each is for its own kind of machine (p. 89)
      if (!availableUpgrades(entry).some(function (g) { return g.n === upgradeN; })) return { ok: false, why: 'That Upgrade is not open to this machine.' };
      entry.exp -= 10;
      entry.upgrades.push(upgradeN);
      var UT = upgradeTable(entry.key);
      entry.history.push('Fitted ' + UT[upgradeN - 1].name + '.');
      return { ok: true, upgrade: UT[upgradeN - 1], cost: 10 };
    }

    return {
      fieldReport: fieldReport, canFieldArmy: canFieldArmy, asPromoted: asPromoted,
      promotionProgress: promotionProgress, canPromoteCompany: canPromoteCompany,
      promoteCompany: promoteCompany, canAspire: canAspire, effectiveTier: effectiveTier,
      recruitCost: recruitCost, canRecruit: canRecruit, recruit: recruit, canDisband: canDisband,
      disband: disband, promoteUnit: promoteUnit, takeHonour: takeHonour, takeUpgrade: takeUpgrade
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCCampCompany;
})(typeof window !== 'undefined' ? window : global);
