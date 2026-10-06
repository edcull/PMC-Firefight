/* PMC 2670 — Firefight : the other forces on the world: founding them, the contracts on offer, and how a rival grows between battles

   Made once by campaign.js, the first time it is wanted, with E: the names
   of campaign.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCCampRivals = function (E) {
    var COMPANY_COST = E.COMPANY_COST, LEADERBUG_BY_TIER = E.LEADERBUG_BY_TIER, R = E.R,
        RECRUIT_COST = E.RECRUIT_COST, RIVAL_COUNT = E.RIVAL_COUNT, archetype = E.archetype,
        archetypesFor = E.archetypesFor, asPromoted = E.asPromoted, availableUpgrades = E.availableUpgrades,
        byRid = E.byRid, canFieldArmy = E.canFieldArmy, canPromoteCompany = E.canPromoteCompany,
        canRecruit = E.canRecruit, canTakeDoctrine = E.canTakeDoctrine, canTakeHonour = E.canTakeHonour,
        canTakeUpgrade = E.canTakeUpgrade, chooseHonour = E.chooseHonour, creedById = E.creedById,
        creedOf = E.creedOf, d6 = E.d6, drawHonours = E.drawHonours, fieldReport = E.fieldReport,
        found = E.found, hasDoctrine = E.hasDoctrine, isLeaderP = E.isLeaderP, levelsFor = E.levelsFor,
        maxBattleTier = E.maxBattleTier, newCompany = E.newCompany, pick = E.pick, profile = E.profile,
        fillsArmy = E.fillsArmy, fullTier = E.fullTier, freeUnit = E.freeUnit, effectiveTier = E.effectiveTier,
        promoteCompany = E.promoteCompany, promoteUnit = E.promoteUnit, promotionCost = E.promotionCost,
        promotionTargets = E.promotionTargets, rebuildNeeds = E.rebuildNeeds, recruit = E.recruit,
        recruitCost = E.recruitCost, rollBattleTier = E.rollBattleTier, rollPayment = E.rollPayment,
        rollScenario = E.rollScenario, foresight = E.foresight, root = E.root, shuffle = E.shuffle, sum = E.sum,
        takeHonour = E.takeHonour, takeUpgrade = E.takeUpgrade, words = E.words;

    function faceRival(campaign, i) {
      if (!campaign.rivals || !campaign.rivals.length) return campaign.companies.B;
      campaign.facing = Math.max(0, Math.min(campaign.rivals.length - 1, i | 0));
      campaign.companies.B = campaign.rivals[campaign.facing];
      return campaign.companies.B;
    }
    /* A save holds each rival once. This puts the alias back, and quietly carries a
       campaign saved against a single rival into the three-force shape. */
    function rehydrate(campaign) {
      if (!campaign || !campaign.companies) return campaign;
      if (!campaign.rivals || !campaign.rivals.length) {
        campaign.rivals = campaign.companies.B ? [campaign.companies.B] : [];
        campaign.facing = 0;
      }
      /* A hotseat campaign holds Player 2 there and nothing else. A save made before
         that was kept may have picked up an AI force on a reload: it goes (HC-3). */
      if (campaign.mode === 'hotseat' && campaign.rivals.length > 1) {
        campaign.rivals = [campaign.rivals[campaign.facing || 0] || campaign.rivals[0]];
        campaign.facing = 0;
      }
      if (campaign.rivals.length) faceRival(campaign, campaign.facing || 0);
      return campaign;
    }
    function forSave(campaign) {
      var out = {}, k;
      for (k in campaign) if (k !== 'companies') out[k] = campaign[k];
      out.companies = { A: campaign.companies.A };     // B is an alias into `rivals`
      return out;
    }

    /* Raise the three. The mix is random but never one-sided: at least one
       mercenary company and at least one revolt, so a campaign always has both
       kinds of war in it. No archetype and no name is used twice. */
    function foundRivals(campaign, n, opts) {
      n = n || RIVAL_COUNT;
      var factions = [];
      for (var i = 0; i < n; i++) factions.push(Math.random() < 0.5 ? 'pmc' : 'rebel');
      if (factions.indexOf('pmc') < 0) factions[Math.floor(Math.random() * n)] = 'pmc';
      // (one force alone is whatever it rolled: there is nobody else to make a revolt of)
      if (n >= 2 && factions.indexOf('rebel') < 0) {
        var at = Math.floor(Math.random() * n);
        while (factions[at] === 'pmc' && factions.filter(function (f) { return f === 'pmc'; }).length < 2) {
          at = Math.floor(Math.random() * n);
        }
        factions[at] = 'rebel';
      }
      /* Now and then the world has bugs on it too (pp. 125-127): one of the three,
         half the time, is a swarm — never the only mercenary or the only revolt. */
      if ((!opts || opts.bugs !== false) && Math.random() < 0.5) {
        var spare = [];
        factions.forEach(function (f, i) { if (factions.filter(function (g) { return g === f; }).length > 1) spare.push(i); });
        if (spare.length) factions[pick(spare)] = 'bugs';
      }
      /* ...and now and then a Xenotripod tribe has claimed some of it (p. 25). */
      if ((!opts || opts.xeno !== false) && Math.random() < 0.5) {
        var spare2 = [];
        factions.forEach(function (f, i) { if (factions.filter(function (g) { return g === f; }).length > 1) spare2.push(i); });
        if (spare2.length) factions[pick(spare2)] = 'xeno';
      }
      // one force alone: any of the four armies, as likely as each other
      if (n === 1) factions[0] = pick(['pmc', 'rebel', 'bugs', 'xeno']);
      // the armies the player asked for, where they asked (the rest stay as rolled)
      if (opts && opts.factions) opts.factions.slice(0, n).forEach(function (f, i) { if (f && archetypesFor(f).length) factions[i] = f; });
      var usedArch = {}, usedNames = [];
      campaign.rivals = factions.map(function (f, k) {
        var pool = archetypesFor(f).filter(function (a) { return !usedArch[a.id]; });
        var a = pick(pool.length ? pool : archetypesFor(f));
        usedArch[a.id] = 1;
        var co = newCompany('Rival ' + (k + 1), { faction: f });
        foundRival(co, a.id, usedNames);
        usedNames.push(co.name);
        return co;
      });
      campaign.facing = Math.floor(Math.random() * campaign.rivals.length);
      faceRival(campaign, campaign.facing);
      return campaign.rivals;
    }

    /* Draw the next opponent — never the one just fought, while there is a choice. */
    /* ---------------- the contracts on the table ----------------
       Three forces are on this world, and the player picks which one to take on
       rather than being handed whichever came up. Each offer is a whole job: who
       it is against, what the fighting is for, and — where the scenario has an
       attacker and a defender — which of the two the player would be.

       What the offer does NOT carry is any sight of the enemy's list. You know
       their name, their reputation and the way they fight; you find out what they
       brought when it comes over the hill.

       The offers are rolled once a campaign turn and kept, so backing out of the
       screen cannot be used to roll for a softer job. */
    function rollOffers(campaign) {
      var A = campaign.companies.A;
      var SC = root.PMCScen;
      if (campaign.offers && campaign.offersTurn === campaign.turn) return campaign.offers;
      var rivals = campaign.rivals && campaign.rivals.length
        ? campaign.rivals : [campaign.companies.B];

      /* Every force on the world has been fighting elsewhere, so each comes to the
         table at something like the player's own standing, give or take. */
      var caught = rivals.map(function (co) {
        var want = catchUpTarget(A.tier);
        return co.tier < want ? catchUp(co, want) : null;
      });

      /* What each force can really put on the table: the highest Tier at which it can
         field a legal army that spends the whole of the composition points, the free
         Tier I units taken on first if they help. Tier I is always within reach; one
         that somehow cannot field even that sits the turn out to regroup. */
      var caps = rivals.map(function (co) {
        var c = fullTier(co, 1);
        if (c < effectiveTier(co)) { topUpFree(co); c = fullTier(co, 1); }
        if (!c) { developRival(co); c = fullTier(co, 1); }
        co.regrouping = !c;
        return c;
      });
      var able = rivals.map(function (co, i) { return i; }).filter(function (i) { return caps[i] > 0; });
      // (if nobody on the world is fit, the contracts go ahead at whatever they can field)
      if (!able.length) { able = rivals.map(function (co, i) { return i; }); rivals.forEach(function (co) { co.regrouping = false; }); }

      /* How many jobs there are this turn. One a force is the usual week; now and
         then the world is quiet and one of them has nothing to offer, and now and
         then it is busy and somebody is fighting on two fronts at once. */
      var n = able.length, roll = d6();
      var count = roll === 1 ? n - 1 : roll === 6 ? n + (d6() >= 5 ? 2 : 1) : n;
      count = Math.max(1, Math.min(n * 2, count));

      // deal the forces out: everyone gets one before anyone gets two
      var order = shuffle(able.slice());
      var deal = [];
      while (deal.length < count) {
        deal = deal.concat(order.slice(0, Math.min(order.length, count - deal.length)));
        order = shuffle(order);
      }

      // each job is on a world of its own, rolled with it and shown on the offer
      var PLANETS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
      campaign.offers = deal.map(function (idx) {
        var co = rivals[idx];
        // Foresighted Command (p. 141): the rival's and the player's (camp-contract.js)
        var fs = foresight(A, co, true);
        var scen = fs.scenario || fs.fore.dice[0];
        var tier = rollBattleTier(A, co);
        // no bigger a fight than the force can field in full
        if (caps[idx] && caps[idx] < tier.cap) {
          tier.cap = caps[idx]; tier.tier = Math.min(tier.roll, tier.cap);
          tier.thin = tier.cap < Math.min(tier.roll, tier.standing);
        }
        var cap1 = caps[idx] ? Math.min(maxBattleTier(A, co, 1), caps[idx]) : maxBattleTier(A, co, 1);
        var full2 = function (t, levels) { return levels.filter(function (pl) { return pl === 1 || fillsArmy(co, t, pl); }); };
        var docs = { A: A.doctrines || [], B: co.doctrines || [] };
        var alt = fs.alt || null;
        return {
          alt: alt, fore: fs.fore || null, foreNote: fs.note || null,
          planet: pick(PLANETS),
          altRoles: alt && SC ? SC.rollRoles(alt.id, docs, null, ['A']) : null,
          rival: idx,
          scenario: scen,
          tierRoll: tier,
          tier: tier.tier,
          levels: full2(tier.tier, levelsFor(A, co, tier.tier)),
          // the biggest fight this pairing could put on, whatever the D6 said
          capTier: cap1,
          capLevels: full2(cap1, levelsFor(A, co, cap1)),
          roles: SC ? SC.rollRoles(scen.id, docs, null, ['A']) : null,
          caught: caught[idx]
        };
      });
      campaign.offersTurn = campaign.turn;
      return campaign.offers;
    }
    function clearOffers(campaign) {
      campaign.offers = null;
      campaign.offersTurn = -1;
    }

    function drawRival(campaign) {
      if (!campaign.rivals || campaign.rivals.length < 2) return faceRival(campaign, 0);
      var options = [];
      for (var i = 0; i < campaign.rivals.length; i++) if (i !== campaign.facing) options.push(i);
      return faceRival(campaign, pick(options));
    }

    /* Bring a force up to the standing it needs to be worth fighting. It is given
       the money a season's work elsewhere would have paid and spends it the way a
       rival does; the target is the player's own Tier give or take one, and it is
       never allowed to outstrip them by more than a Tier. */
    function catchUpTarget(playerTier) {
      var swing = pick([-1, 0, 0, 0, 1]);
      return Math.max(1, Math.min(5, Math.min(playerTier + 1, playerTier + swing)));
    }
    /* Hire until a legal army exists at this Tier and Level. A force that has been
       fighting elsewhere for a season is deep enough for the contracts it takes;
       this is what makes that true, and it is what the standing gates on p. 84 —
       a Tier III Priority Level 2 army before Tier IV — actually ask for. */
    function deepen(co, tier, pl, asTier) {
      // a swarm reaching up a Tier is judged with its Overmind already grown (p. 124)
      var grown = Math.max(asTier || 0, tier);
      function view() { return co.faction === 'bugs' && grown > co.tier ? asPromoted(co, grown) : co; }
      for (var g = 0; g < 60 && !canFieldArmy(view(), tier, pl); g++) {
        if (co.faction === 'bugs' && /Leader Bug/.test(fieldReport(view(), tier, pl).fault || '')) {
          var lk = LEADERBUG_BY_TIER[tier];
          if (!canRecruit(co, lk).ok) { if (R.profile(lk).tier >= profile(byRid(co, co.cmdRid).key).tier) break; co.kUC += RECRUIT_COST[tier]; continue; }
          recruit(co, lk); continue;
        }
        /* Only the Battle Tier's own units are hired. That row of the composition
           table is the one with a minimum and no maximum, so adding to it always
           helps and can never break another limit. */
        var pool = R.listFor(co.faction).filter(function (p) {
          // a swarm's Tier V is all Overgrown, so for bugs the big ones count
          if ((p.cls !== 'infantry' && !(co.faction === 'bugs' && p.cls === 'vehicle')) || isLeaderP(p) || p.tier !== tier) return false;
          if (!p.cap) return true;
          return co.roster.filter(function (e) { return e.key === p.key; }).length < p.cap;
        });
        if (!pool.length) break;                        // nothing at this Tier it may hire
        pool.sort(function (x, y) { return recruitCost(co, x.key) - recruitCost(co, y.key); });
        var take = pool.filter(function (p) { return canRecruit(co, p.key).ok; })[0];
        if (!take) { co.kUC += RECRUIT_COST[tier] || 8; continue; }   // a season's earnings
        if (!recruit(co, take.key).ok) break;
      }
      return canFieldArmy(view(), tier, pl);
    }

    function catchUp(co, target) {
      var from = co.tier, guard = 0;
      while (co.tier < target && guard++ < 120) {
        co.kUC += Math.max(6, Math.ceil((COMPANY_COST[co.tier + 1] || 8) / 4) + 3 * co.tier);
        // clear whatever stands between it and the next standing
        for (var t = 1; t <= Math.min(5, co.tier + 1); t++) deepen(co, t, 1, co.tier + 1);
        if (co.tier + 1 === 4) deepen(co, 3, 2, 4);
        developRival(co);
      }
      // and a roster that can put an army on the table at the Tier it reached
      for (var g2 = 0; g2 < 40 && !canFieldArmy(co, Math.min(co.tier, target), 1); g2++) {
        co.kUC += 6 + 2 * co.tier;
        developRival(co);
      }
      return { name: co.name, from: from, to: co.tier, target: target };
    }

    /* Between your battles, the forces you did not fight were busy. They take a
       payment at their own Tier and spend it, so the world moves on without you. */
    function idleTurn(co) {
      var take = sum(rollPayment(Math.max(1, co.tier), 1));
      co.kUC += take;
      var did = developRival(co);
      return { name: co.name, kUC: take, did: did };
    }

    /* Found a rival to the book's starting rules, in its archetype's own style. */
    function foundRival(co, archId, usedNames) {
      var a = archId ? archetype(archId) : pick(archetypesFor(co.faction));
      co.faction = a.faction || 'pmc';
      var names = a.names.filter(function (n) { return !usedNames || usedNames.indexOf(n) < 0; });
      co.name = pick(names.length ? names : a.names);
      co.archetype = a.id;
      co.blurb = a.blurb;
      // the machines it means to start with, each hull taken once
      var hulls = a.machines.slice(0, a.vehicles);
      var h1 = hulls.filter(function (k) { return profile(k).tier === 1; });
      var h2 = hulls.filter(function (k) { return profile(k).tier === 2; });
      /* It starts with units it paid for: the free ones (Penal troops, Armed civilians,
         Tiny bug swarms, Primitive Epsilon troopers) are taken on later, as it needs them. */
      var paid = a.t1.filter(function (k) { return !freeUnit(k); });
      var keys = [], t1pool = paid.length ? paid : a.t1.slice(), t2pool = a.t2.slice();
      for (var i = 0; i < 6 - h1.length; i++) keys.push(t1pool[i % t1pool.length]);
      h1.forEach(function (k) { keys.push(k); });
      for (var j = 0; j < 2 - h2.length; j++) keys.push(t2pool[j % t2pool.length]);
      h2.forEach(function (k) { keys.push(k); });
      /* No fixed theme: the doctrines it will grow into are drawn at random, in
         the order it will take them, and its character is read from them. */
      co.docPlan = shuffle(creedOf(co).list.map(function (d) { return d.id; }));
      var res = found(co, keys, co.docPlan[0]);
      // a starting list that breaks a per-army cap gets the offender swapped out
      for (var g = 0; g < 8 && !res.ok; g++) {
        co.roster.some(function (e, idx) {
          if (e.free) return false;
          var p = profile(e.key);
          if (p.cls === 'infantry') return false;
          keys[idx - 1] = pick(t1pool);
          return true;
        });
        res = found(co, keys, co.docPlan[0]);
      }
      co.blurb = null;
      return co;
    }

    /* The free Tier I units taken on when they let a force field a bigger army in
       full — its own Tier at most. Four of a kind at the most (the first four are the
       free ones, and Penal troops are four to an army); kept only if they helped. */
    function topUpFree(co) {
      var want = effectiveTier(co), was = fullTier(co, 1), added = [];
      if (was >= want) return [];
      for (var n = 0; n < 8 && fullTier(co, 1) < want; n++) {
        var p = R.listFor(co.faction).filter(function (q) {
          return freeUnit(q.key) && recruitCost(co, q.key) === 0 && canRecruit(co, q.key).ok &&
            co.roster.filter(function (e) { return e.key === q.key; }).length < 4;
        })[0];
        if (!p) break;
        var r = recruit(co, p.key);
        if (!r.ok) break;
        added.push(r.entry);
      }
      if (added.length && fullTier(co, 1) <= was) {
        co.roster = co.roster.filter(function (e) { return added.indexOf(e) < 0; });
        return [];
      }
      return added.map(function (e) { return { what: 'recruit', text: 'took on ' + e.name }; });
    }

    /* One campaign turn of development, in the archetype's own direction. */
    function developRival(co) {
      var a = archetype(co.archetype);
      var did = [];
      function wanted(p) { return a.groups.indexOf(p.group) >= 0; }

      /* Close every legality gap, cheapest Tier first, until the money runs out.
         Run once before spending and once after, because promoting a Tier I unit
         out of the list is the usual way a gap opens in the first place. */
      function machineCount() {
        return co.roster.filter(function (e) { return profile(e.key).cls !== 'infantry'; }).length;
      }
      function fillGaps() {
        for (var round = 0; round < 12; round++) {
          var gaps = rebuildNeeds(co);
          if (!gaps.length) return;
          var t = gaps[0];
          /* A swarm that cannot field a Tier because it has no Leader Bug low enough
             spawns one: the lowest it may, at that Tier or above. */
          if (co.faction === 'bugs' && /Leader Bug/.test(fieldReport(co, t, 1).fault || '')) {
            var lb = R.listFor('bugs').filter(function (p) { return p.leaderBug && p.tier === t && canRecruit(co, p.key).ok; })[0];
            if (!lb) return;
            var rl = recruit(co, lb.key);
            if (!rl.ok) return;
            did.push({ what: 'recruit', text: 'spawned ' + rl.entry.name });
            continue;
          }
          var room = machineCount() < 3;
          var pool = R.listFor(co.faction).filter(function (p) {
            if (p.tier !== t || isLeaderP(p) || !canRecruit(co, p.key).ok) return false;
            if (p.noSlot) return false;                          // a platform fills no slot, so it can close no gap
            if (p.cls !== 'infantry') return room && wanted(p);   // only a machine company buys a hull to fill a gap
            return true;
          });
          if (!pool.length) return;                    // nothing affordable: wait for payday
          // its own groups first; failing that, the units it was founded with, which
          // is what keeps a company in character at the Tiers its groups do not reach
          var liked = pool.filter(wanted);
          if (!liked.length) {
            var own = t === 1 ? a.t1 : t === 2 ? a.t2 : [];
            liked = pool.filter(function (p) { return own.indexOf(p.key) >= 0; });
          }
          var r = recruit(co, pick(liked.length ? liked : pool).key);
          if (!r.ok) return;
          did.push({ what: 'recruit', text: 'recruited ' + r.entry.name });
        }
      }
      fillGaps();
      did = did.concat(topUpFree(co));

      // spend experience, the units closest to a decision first
      co.roster.slice().sort(function (x, y) { return y.exp - x.exp; }).forEach(function (e) {
        var p = profile(e.key), was = e.name;
        /* An Overgrown bug is a beast, not a hull: it grows Adaptations as the infantry
           earns honours (p. 124), and has no Upgrades to buy. */
        if (p.cls !== 'infantry' && p.faction === 'bugs') {
          for (var ad = 0; ad < 6 && canTakeHonour(e, co).ok; ad++) {
            var h0 = chooseHonour(drawHonours(e));
            if (!h0 || !takeHonour(co, e, h0.n).ok) break;
            did.push({ what: 'honour', text: e.name + ' grew ' + h0.name });
          }
          return;
        }
        if (p.cls !== 'infantry') {
          if (canTakeUpgrade(e).ok) {
            var pool = availableUpgrades(e);
            // a machine-minded company buys armour and guns before anything else
            var first = pool.filter(function (g) { return [8, 5, 3, 10].indexOf(g.n) >= 0; });
            var g = pick(first.length && a.spend === 'machines' ? first : pool);
            if (takeUpgrade(co, e, g.n).ok) did.push({ what: 'upgrade', text: e.name + ' fitted ' + g.name });
          }
          return;
        }
        // a sideways step inside its own group (recruits to irregulars) gains a simulated company nothing
        var all = promotionTargets(e, co).filter(function (q) { return q.tier > p.tier || q.group !== p.group; });
        var affordable = all.filter(function (q) { return rivalCanAfford(co, e, q.key); });
        /* If this unit could ever promote into one of the company's own groups, it
           waits until it can afford that rather than taking the first cheap step
           out of character — which is how an Elite company ended up full of mortars. */
        var likedAll = all.filter(wanted);
        var targets = likedAll.length ? affordable.filter(wanted) : affordable;
        /* ...and a promoting company's unit with nowhere it wants to go keeps its
           experience for an honour rather than stepping out of character, which is
           what lets its veterans pick up the odd honour from mid-campaign. */
        if (a.spend === 'promote' && !likedAll.length) targets = [];
        function honour() {
          if (!canTakeHonour(e, co).ok) return false;
          var h = chooseHonour(drawHonours(e));
          if (!h || !takeHonour(co, e, h.n).ok) return false;
          did.push({ what: 'honour', text: e.name + ' earned ' + h.name });
          return true;
        }
        // an honours company trains a unit to its cap before it promotes it at all,
        // which is what makes a Marksmen company read as veterans rather than as rank
        if (a.spend === 'honours') { for (var g = 0; g < 6 && honour(); g++) { } }
        if (targets.length) {
          var best = targets.sort(function (x, y) { return y.tier - x.tier; })[0];
          if (promoteUnit(co, e, best.key).ok) {
            did.push({ what: 'promote', text: was + ' promoted to ' + e.name });
          }
        }
        honour();                                     // whatever experience is left
      });

      // a company that recruits for a living keeps buying while it can afford to
      // ...though a company within reach of a Company Tier banks the money instead
      var nextCost = COMPANY_COST[co.tier + 1];
      var saving = nextCost && co.kUC >= nextCost * 0.6 && canPromoteCompany(co).faults
        .every(function (f) { return /costs/.test(f); });
      if (a.spend === 'recruit' && !saving) {
        for (var n = 0; n < 3; n++) {
          var pool2 = R.listFor(co.faction).filter(function (p) {
            if (p.cls !== 'infantry' || isLeaderP(p) || p.tier > co.tier) return false;
            if (!wanted(p) && a.t1.indexOf(p.key) < 0 && a.t2.indexOf(p.key) < 0) return false;
            if (!canRecruit(co, p.key).ok) return false;
            return p.key === 'penal' || RECRUIT_COST[p.tier] <= co.kUC / 2;
          });
          if (!pool2.length) break;
          var r2 = recruit(co, pick(pool2).key);
          if (!r2.ok) break;
          did.push({ what: 'recruit', text: 'recruited ' + r2.entry.name });
        }
      }
      // and a machine company buys a hull the moment it can
      if (a.spend === 'machines' && co.kUC >= 16 &&
        co.roster.filter(function (e) { return profile(e.key).cls !== 'infantry'; }).length < 3) {
        var hulls = R.listFor(co.faction).filter(function (p) {
          return p.cls !== 'infantry' && !p.noSlot && wanted(p) && canRecruit(co, p.key).ok;
        }).sort(function (x, y) { return y.tier - x.tier; });
        if (hulls.length) {
          var rv = recruit(co, hulls[0].key);
          if (rv.ok) did.push({ what: 'recruit', text: 'took delivery of a ' + rv.entry.name });
        }
      }

      /* A company sitting on money it has no use for hires. Anything it is saving
         toward a Company Tier is left alone — that promotion is worth more. */
      var next = COMPANY_COST[co.tier + 1];
      var savingFor = next && canPromoteCompany(co).faults.every(function (f) { return /costs/.test(f); });
      if (!savingFor || co.kUC > next * 2) {
        for (var w = 0; w < 4 && co.kUC >= 24; w++) {
          var want = R.listFor(co.faction).filter(function (p) {
            return p.cls === 'infantry' && !isLeaderP(p) && wanted(p) &&
              p.tier <= co.tier + 1 && canRecruit(co, p.key).ok;
          }).sort(function (x, y) { return y.tier - x.tier; });
          if (!want.length) break;
          var rw = recruit(co, want[0].key);
          if (!rw.ok) break;
          did.push({ what: 'recruit', text: 'recruited ' + rw.entry.name });
        }
      }

      fillGaps();
      /* A swarm about to grow needs a Leader Bug for every smaller army it will
         still be asked to field, since its Overmind will be too big to lead them. */
      if (co.faction === 'bugs' && co.tier < 5) {
        var probe = asPromoted(co, co.tier + 1);
        for (var lt = 1; lt <= co.tier; lt++) {
          if (!/Leader Bug/.test(fieldReport(probe, lt, 1).fault || '')) continue;
          var lk = LEADERBUG_BY_TIER[lt];
          if (canRecruit(co, lk).ok) {
            var rl2 = recruit(co, lk);
            if (rl2.ok) did.push({ what: 'recruit', text: 'spawned ' + rl2.entry.name });
          }
        }
      }
      var pr = canPromoteCompany(co);
      if (pr.ok) {
        promoteCompany(co);
        var creed = creedOf(co);
        var next = (co.docPlan || a.doctrines).filter(function (d) { return canTakeDoctrine(co, d).ok; });
        var free = next.length ? next
          : creed.list.filter(function (d) { return canTakeDoctrine(co, d.id).ok; }).map(function (d) { return d.id; });
        if (free.length) {
          co.doctrines.push(free[0]);
          did.push({ what: 'doctrine', text: 'adopted ' + creedById(free[0]).name });
        }
        did.push({ what: 'tier', text: 'promoted to ' + words(co).tier + ' Tier ' + R.ROMAN[co.tier] });
      }
      /* Whatever the fighting and the promotions have left it short of, a force
         out working the world hires back to a legal army at every Tier it holds:
         it is always ready for the next contract. */
      rebuildNeeds(co).forEach(function (t) {
        // only a shortage is mended by hiring; a list over a cap is not
        if (!(fieldReport(co, t, 1).missing || []).length) return;
        var n = co.roster.length;
        if (deepen(co, t, 1) && co.roster.length > n) did.push({ what: 'recruit', text: 'hired back up to a legal Tier ' + R.ROMAN[t] + ' army' });
      });
      return did;
    }

    // what a promotion costs this company, Smuggler's point off and Hermetic Society's half price (p. 141) included
    function rivalCanAfford(co, e, key) {
      var c = promotionCost(e, key, co);
      return e.exp >= c.exp && co.kUC >= c.kUC;
    }

    return {
      rivalCanAfford: rivalCanAfford,
      faceRival: faceRival, rehydrate: rehydrate, forSave: forSave, foundRivals: foundRivals,
      rollOffers: rollOffers, clearOffers: clearOffers, drawRival: drawRival, catchUpTarget: catchUpTarget,
      deepen: deepen, catchUp: catchUp, idleTurn: idleTurn, foundRival: foundRival, developRival: developRival
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCCampRivals;
})(typeof window !== 'undefined' ? window : global);
