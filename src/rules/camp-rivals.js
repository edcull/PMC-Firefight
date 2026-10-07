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
        fillsArmy = E.fillsArmy, fullTier = E.fullTier, freeUnit = E.freeUnit, effectiveTier = E.effectiveTier, commandKey = E.commandKey,
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
         Tier I units taken on first if they help. A force that cannot field even Tier I
         (nothing left but its four free units) sits the turn out to regroup; one still
         unable after that turn of recovery is broken up and leaves the campaign. */
      var caps = rivals.map(function (co) {
        var c = fullTier(co, 1);
        // (a force that will not pad its army with them — the Elite — takes them only to regroup)
        var arch0 = co.archetype ? archetype(co.archetype) : null;
        if (c < effectiveTier(co) && !(arch0 && arch0.lean)) { topUpFree(co); c = fullTier(co, 1); }
        /* Regrouping: a resource point scraped together (once a turn) and spent at
           once on what it can buy towards a Tier I army. */
        if (!c) {
          if (co.regroupPaid !== campaign.turn) { co.kUC = (co.kUC || 0) + 1; co.regroupPaid = campaign.turn; }
          topUpFree(co); developRival(co); c = fullTier(co, 1);
        }
        if (!c && !co.regrouping) co.regroupTurn = campaign.turn;
        co.regrouping = !c;
        return c;
      });
      if (campaign.mode === 'solo' && !campaign.world && rivals === campaign.rivals) {
        var gone = rivals.filter(function (co) { return co.regrouping && co.regroupTurn < campaign.turn; });
        if (gone.length && gone.length < rivals.length) {
          var B0 = campaign.companies.B;
          campaign.brokenUp = (campaign.brokenUp || []).concat(gone.map(function (co) {
            return { name: co.name, faction: co.faction, turn: campaign.turn };
          }));
          var stay = function (x, i) { return gone.indexOf(rivals[i]) < 0; };
          caps = caps.filter(stay); caught = caught.filter(stay);
          rivals = campaign.rivals = rivals.filter(function (co) { return gone.indexOf(co) < 0; });
          faceRival(campaign, Math.max(0, rivals.indexOf(B0)));
        }
      }
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
    /* A force with a mix to keep (`mix`: Special Ops' two light infantry to each rifle
       team) leans each choice towards whichever of its groups is furthest below its
       share; groups outside the mix sit in the middle. */
    function mixShortfall(co, a, g) {
      var m = (a && a.mix) || {}, w = m[g];
      if (!w) return 0;
      var tot = 0, wsum = 0;
      for (var k in m) { wsum += m[k]; tot += co.roster.filter(function (e) { return profile(e.key).group === k; }).length; }
      var have = co.roster.filter(function (e) { return profile(e.key).group === g; }).length;
      return w / wsum - (tot ? have / tot : 0);
    }
    function leanTo(co, a, list) {
      if (!a || !a.mix || list.length < 2) return pick(list);
      var best = Math.max.apply(null, list.map(function (p) { return mixShortfall(co, a, p.group); }));
      return pick(list.filter(function (p) { return mixShortfall(co, a, p.group) === best; }));
    }
    /* A force that rides (`riders`: Free Space's Holy Warriors and leaders) recruits a
       unit of those groups mounted wherever the unit may take the Riders upgrade —
       which is decided when it is recruited (p. 97), so only a recruit rides. */
    var recruitBase = recruit;
    recruit = function (co, key, opts) {
      var a0 = co && co.archetype ? archetype(co.archetype) : null, p0 = profile(key);
      if (!opts && a0 && a0.riders && p0 && a0.riders.indexOf(p0.group) >= 0 && R.canRide(p0)) opts = { riders: true };
      return recruitBase(co, key, opts);
    };
    function flat(list) { return [].concat.apply([], list || []); }
    /* A force that keeps some units rare (`limit`: Special Ops' one LRRP team, one of
       snipers, two mortar units) neither recruits nor promotes past it. A key limits
       that unit, a group name the whole group. */
    function atLimit(co, a, p) {
      var lim = (a && a.limit) || {};
      if (lim[p.key] != null && co.roster.filter(function (e) { return e.key === p.key; }).length >= lim[p.key]) return true;
      if (lim[p.group] != null && co.roster.filter(function (e) { return profile(e.key).group === p.group; }).length >= lim[p.group]) return true;
      return false;
    }
    // { irregulars: 11, recruits: 1 } as a list naming each as often as its weight
    function weighted(w) { var out = []; for (var k in w) for (var i = 0; i < w[k]; i++) out.push(k); return out; }
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
    /* The order it will take its doctrines in, one per Tier, written when it is
       founded. A force known for one thing takes it first (`fixed`: the Grey Plague's
       Fungi Symbiosis, the raiders' teleport network); most then reach for their own
       shortlist (`doctrines`, in a random order of their own); and a force with no
       creed to speak of (`random`) draws from the whole list. Whatever is left comes
       after, shuffled — a force that has spent its shortlist still has somewhere to go. */
    function docPlanFor(co, a) {
      var all = creedOf(co).list.map(function (d) { return d.id; });
      var fixed = a.random ? [] : (a.fixed || []).filter(function (d) { return all.indexOf(d) >= 0; });
      var short = a.random ? [] : shuffle((a.doctrines || []).filter(function (d) { return all.indexOf(d) >= 0 && fixed.indexOf(d) < 0; }));
      var rest = shuffle(all.filter(function (d) { return fixed.indexOf(d) < 0 && short.indexOf(d) < 0; }));
      return fixed.concat(short, rest);
    }
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
      // (a revolt starts as Armed civilians, free or not: `foundFree` lets it found with them)
      var paid = a.foundFree ? a.t1.slice() : a.t1.filter(function (k) { return !freeUnit(k); });
      var keys = [], t1pool = paid.length ? paid : a.t1.slice(), t2pool = a.t2.slice();
      for (var i = 0; i < 6 - h1.length; i++) keys.push(t1pool[i % t1pool.length]);
      h1.forEach(function (k) { keys.push(k); });
      // (an entry that is itself a list is one of those, picked: Special Ops' observers or nomads)
      for (var j = 0; j < 2 - h2.length; j++) { var k2 = t2pool[j % t2pool.length]; keys.push(Array.isArray(k2) ? pick(k2) : k2); }
      h2.forEach(function (k) { keys.push(k); });
      co.docPlan = docPlanFor(co, a);
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
       full — its own Tier at most. Only while it has fewer than four of a kind (the
       free ones), and kept only if they helped. A force that cannot field even Tier I
       keeps them, and buys the cheapest Tier I units it can afford until it can. */
    function topUpFree(co) {
      var want = effectiveTier(co), was = fullTier(co, 1), added = [];
      if (was >= want) return [];
      function freeOne() {
        // (Penal troops never stop being free, but no more than four go in an army)
        return R.listFor(co.faction).filter(function (q) {
          return freeUnit(q.key) && recruitCost(co, q.key) === 0 && canRecruit(co, q.key).ok &&
            co.roster.filter(function (e) { return e.key === q.key; }).length < 4;
        })[0];
      }
      for (var n = 0; n < 8 && fullTier(co, 1) < want; n++) {
        var p = freeOne();
        if (!p) break;
        var r = recruit(co, p.key);
        if (!r.ok) break;
        added.push(r.entry);
      }
      if (was > 0 && added.length && fullTier(co, 1) <= was) {
        co.roster = co.roster.filter(function (e) { return added.indexOf(e) < 0; });
        added = [];
      }
      for (var m = 0; m < 6 && !fullTier(co, 1); m++) {
        var t1 = R.listFor(co.faction).filter(function (q) {
          return q.tier === 1 && q.cls === 'infantry' && !isLeaderP(q) && canRecruit(co, q.key).ok;
        }).sort(function (x, y) { return recruitCost(co, x.key) - recruitCost(co, y.key); })[0];
        if (!t1) break;
        var r1 = recruit(co, t1.key);
        if (!r1.ok) break;
        added.push(r1.entry);
      }
      return added.map(function (e) { return { what: 'recruit', text: 'took on ' + e.name }; });
    }
    /* Its field command goes up a grade with the force's Tier; the grade it left is
       wanted back as a second command unit (bought at the usual price), for the smaller
       fights the new one is too senior for. A swarm cannot field a smaller fight at all
       without a Leader Bug low enough, so it buys one first, before anything else; any
       other force buys it first when the smaller fight is out of reach without it, and
       otherwise two turns in three — useful to have, but the money has other calls. */
    function rehireCommand(co) {
      if (!co.wantCmdTier) return [];
      var key = commandKey(co, co.wantCmdTier);
      if (!key || co.roster.some(function (e) { return e.key === key; })) { co.wantCmdTier = null; return []; }
      if (!canRecruit(co, key).ok) return [];
      if (co.faction !== 'bugs' && fillsArmy(co, co.wantCmdTier, 1) && Math.random() >= 2 / 3) return [];
      var r = recruit(co, key);
      if (!r.ok) return [];
      co.wantCmdTier = null;
      return [{ what: 'recruit', text: 'raised a second command, ' + r.entry.name }];
    }

    /* One campaign turn of development, in the archetype's own direction. */
    function developRival(co) {
      var a = archetype(co.archetype);
      var did = rehireCommand(co);            // first call on the money, when it is due
      // its own groups, and the odd unit it favours from a group it otherwise does not (`units`)
      function wanted(p) { return a.groups.indexOf(p.group) >= 0 || (a.units || []).indexOf(p.key) >= 0; }
      function shortfall(g) { return mixShortfall(co, a, g); }
      function capped(p) { return atLimit(co, a, p); }
      function leaning(list) { return leanTo(co, a, list); }
      // Penal troops are free for ever but four to an army: a fifth is no use to anyone
      function fullUp(p) { return p.key === 'penal' && co.roster.filter(function (e) { return e.key === 'penal'; }).length >= 4; }

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
          var room = machineCount() < (a.machinesMax || 3);
          var pool = R.listFor(co.faction).filter(function (p) {
            if (p.tier !== t || isLeaderP(p) || !canRecruit(co, p.key).ok) return false;
            if (p.noSlot || fullUp(p) || capped(p)) return false;                          // a platform fills no slot, so it can close no gap
            if (p.cls !== 'infantry') return room && wanted(p);   // only a machine company buys a hull to fill a gap
            return true;
          });
          if (!pool.length) return;                    // nothing affordable: wait for payday
          // its own groups first; failing that, the units it was founded with, which
          // is what keeps a company in character at the Tiers its groups do not reach
          var liked = pool.filter(wanted);
          if (!liked.length) {
            var own = t === 1 ? (a.refill ? weighted(a.refill) : a.t1) : t === 2 ? flat(a.t2) : [];
            // as often as the founding list names them (Special Ops: two Irregulars to each Recruit)
            liked = [];
            own.forEach(function (k) { pool.forEach(function (p) { if (p.key === k) liked.push(p); }); });
          }
          var r = recruit(co, leaning(liked.length ? liked : pool).key);
          if (!r.ok) return;
          did.push({ what: 'recruit', text: 'recruited ' + r.entry.name });
        }
      }
      fillGaps();
      did = did.concat(rehireCommand(co));
      /* Its signature units — what the force is known for, which nothing else on its
         shopping list would bring in (a sky swarm's flyers, a plague's Infected): one
         for each Tier it holds (three at most), the best it can afford, before the money
         goes elsewhere. A list of lists is several such sets, each kept up on its own
         (Special Ops: its cars and craft, and its drones and EW). */
      var sigs = a.signature || [];
      (Array.isArray(sigs[0]) ? sigs : [sigs]).forEach(function (sig) {
        if (!sig.length) return;
        var have = co.roster.filter(function (e) { return sig.indexOf(e.key) >= 0; }).length;
        if (have >= Math.min(a.signatureMax || 3, co.tier)) return;
        var can = sig.map(profile).filter(function (p) { return p.tier <= co.tier + 1 && canRecruit(co, p.key).ok && !capped(p); });
        var top = Math.max.apply(null, can.map(function (p) { return p.tier; }).concat([0]));
        var buy = can.length ? pick(can.filter(function (p) { return p.tier === top; })) : null;
        if (!buy) return;
        var rs = recruit(co, buy.key);
        if (rs.ok) did.push({ what: 'recruit', text: words(co).recruited + ' ' + rs.entry.name });
      });

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
        var all = promotionTargets(e, co).filter(function (q) { return (q.tier > p.tier || q.group !== p.group) && !capped(q); });
        var affordable = all.filter(function (q) { return rivalCanAfford(co, e, q.key); });
        /* If this unit could ever promote into one of the company's own groups, it
           waits until it can afford that rather than taking the first cheap step
           out of character — which is how an Elite company ended up full of mortars. */
        var likedAll = all.filter(wanted);
        var targets = likedAll.length ? affordable.filter(wanted) : affordable;
        /* ...and a unit with nowhere it wants to go keeps its experience for an honour
           rather than stepping out of character, which is what lets its veterans pick
           up the odd honour from mid-campaign (a Mercenary's machine gunners stay on the
           guns rather than becoming anti-tank teams it does not hire). */
        if (!likedAll.length) targets = [];
        /* A force keeping a mix holds a unit to its own line unless the line it would
           cross to is the shorter of its share (the Bastion's machine guns stay machine
           guns, half and half with its anti-tank teams), waiting for the step up instead. */
        if (a.mix && a.mix[p.group]) {
          // (it crosses only into a line shorter of its share than its own; with no step up its own line, it waits)
          targets = targets.filter(function (q) { return q.group === p.group || shortfall(q.group) > shortfall(p.group); });
        }
        function honour() {
          if (!canTakeHonour(e, co).ok) return false;
          var h = chooseHonour(drawHonours(e));
          if (!h || !takeHonour(co, e, h.n).ok) return false;
          did.push({ what: 'honour', text: e.name + ' earned ' + h.name });
          return true;
        }
        /* An honours company trains a unit to its cap before it promotes it at all,
           which is what makes it read as veterans rather than as rank — once the unit
           is one of its own: a recruit with a way into its groups is promoted there first. */
        var stepIn = !wanted(p) && targets.length;
        if (a.spend === 'honours' && !stepIn) { for (var g = 0; g < 6 && honour(); g++) { } }
        /* (a force that decorates its people on the way up — the Elite — gives a unit an honour
           before its first promotion, once it holds Rapid Training Methods and the first one is cheap) */
        if (a.honourFirst && hasDoctrine(co, 'S6') && !(e.honours || []).length && !stepIn) honour();
        if (targets.length) {
          var best = targets.sort(function (x, y) { return y.tier - x.tier || shortfall(y.group) - shortfall(x.group); })[0];
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
            if (!wanted(p) && a.t1.indexOf(p.key) < 0 && flat(a.t2).indexOf(p.key) < 0) return false;
            if (capped(p)) return false;
            if (!canRecruit(co, p.key).ok || fullUp(p)) return false;
            return p.key === 'penal' || RECRUIT_COST[p.tier] <= co.kUC / 2;
          });
          if (!pool2.length) break;
          var r2 = recruit(co, leaning(pool2).key);
          if (!r2.ok) break;
          did.push({ what: 'recruit', text: 'recruited ' + r2.entry.name });
        }
      }
      // and a machine company buys a hull the moment it can
      /* A machine company buys a hull the moment it can. The Cavalry keeps buying
         until it has a Priority Level 2 army's worth (`machinesMax`), whatever it can
         field at its own Tier, the next one the moment the money is there; the Bastion
         keeps four, its tank hunters, destroyers and gun carriers. */
      // (and a force with hulls of its own to keep — the Bastion's guns — buys them however else it spends)
      if (a.spend === 'machines' || a.machinesMax) {
        var cap = a.machinesMax || 3, bought = 0;
        while (bought < 2 && co.roster.filter(function (e) { return profile(e.key).cls !== 'infantry'; }).length < cap) {
          if (!a.machinesMax && co.kUC < 16) break;
          var hulls = R.listFor(co.faction).filter(function (p) {
            return p.cls !== 'infantry' && !p.noSlot && wanted(p) && canRecruit(co, p.key).ok && (!a.machinesMax || p.tier <= co.tier);
          }).sort(function (x, y) { return y.tier - x.tier; });
          if (!hulls.length) break;
          // (the hulls it is known for first, where it has a preference: the Bastion's guns)
          var firstH = hulls.filter(function (p) { return (a.hullsFirst || []).indexOf(p.group) >= 0; });
          if (firstH.length) hulls = firstH;
          var top = hulls[0].tier, pickH = a.machinesMax ? pick(hulls.filter(function (p) { return p.tier === top; })) : hulls[0];
          var rv = recruit(co, pickH.key);
          if (!rv.ok) break;
          did.push({ what: 'recruit', text: 'took delivery of a ' + rv.entry.name });
          bought++;
          if (!a.machinesMax) break;
        }
        /* ...and once it has all it means to keep, the smallest goes for a bigger one
           when the money is there: the guns grow with the force. */
        if (a.machinesMax) {
          var owned = co.roster.filter(function (e) { var q = profile(e.key); return q.cls !== 'infantry' && !q.noSlot && wanted(q); });
          if (owned.length >= cap) {
            var small = owned.slice().sort(function (x, y) { return profile(x.key).tier - profile(y.key).tier; })[0];
            var bigger = R.listFor(co.faction).filter(function (p) {
              return p.cls !== 'infantry' && !p.noSlot && wanted(p) && p.tier <= co.tier && p.tier >= profile(small.key).tier + 1 && canRecruit(co, p.key).ok;
            });
            var firstB = bigger.filter(function (p) { return (a.hullsFirst || []).indexOf(p.group) >= 0; });
            if (firstB.length) bigger = firstB;
            if (bigger.length && small.rid !== co.cmdRid) {
              var nb = recruit(co, pick(bigger).key);
              if (nb.ok) {
                co.roster = co.roster.filter(function (e) { return e !== small; });
                did.push({ what: 'recruit', text: 'traded the ' + small.name + ' for a ' + nb.entry.name });
              }
            }
          }
        }
      }

      /* A company sitting on money it has no use for hires. Anything it is saving
         toward a Company Tier is left alone — that promotion is worth more. */
      var next = COMPANY_COST[co.tier + 1];
      var savingFor = next && canPromoteCompany(co).faults.every(function (f) { return /costs/.test(f); });
      // (a lean force — the Elite — keeps the money for promotions and its next Tier instead)
      if (!a.lean && (!savingFor || co.kUC > next * 2)) {
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
        var leftTier = co.tier;
        promoteCompany(co);
        co.wantCmdTier = leftTier;
        did = did.concat(rehireCommand(co));
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
