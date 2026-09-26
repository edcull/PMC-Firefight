/* PMC 2670 — Firefight : the contract and its pay: Battle Tier, scenario, payment, experience, trauma and salvage rolls

   Made once by campaign.js, the first time it is wanted, with E: the names
   of campaign.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCCampContract = function (E) {
    var R = E.R, SCENARIOS = E.SCENARIOS, SCENARIO_NAMES = E.SCENARIO_NAMES, byRid = E.byRid,
        canFieldArmy = E.canFieldArmy, d10 = E.d10, d3 = E.d3, d6 = E.d6, effectiveTier = E.effectiveTier,
        hasDoctrine = E.hasDoctrine, hasTraumaFlag = E.hasTraumaFlag, isTurretP = E.isTurretP,
        isXenoKey = E.isXenoKey, money = E.money, newEntry = E.newEntry, pick = E.pick, profile = E.profile,
        takesHonours = E.takesHonours, traumaTable = E.traumaTable, words = E.words;

    /* ================= the contract (p. 84) =================
       The Battle Tier is a D6, but no force can take a contract it cannot actually
       fill. Two things hold it down: the standing each force has reached, and
       whether the units it still has on its feet — machines in the workshop do not
       count — can make a legal army at that Tier. Whichever is lower is the cap,
       and the roll comes down to it. */
    function fieldableTier(co, pl) {
      for (var t = Math.min(5, effectiveTier(co)); t >= 1; t--) {
        if (canFieldArmy(co, t, pl || 1, true)) return t;
      }
      return 0;
    }
    function maxBattleTier(coA, coB, pl) {
      var a = Math.min(effectiveTier(coA), fieldableTier(coA, pl) || effectiveTier(coA));
      var b = Math.min(effectiveTier(coB), fieldableTier(coB, pl) || effectiveTier(coB));
      return Math.max(1, Math.min(5, Math.min(a, b)));
    }
    /* Which Priority Levels this pairing could actually fight at the given Tier. */
    // "players can choose to play bigger ones as long as they can compose legal armies" (p. 84)
    function levelsFor(coA, coB, tier) {
      return [1, 2, 3, 4].filter(function (pl) {
        return canFieldArmy(coA, tier, pl, true) && canFieldArmy(coB, tier, pl, true);
      });
    }
    /* The standard contract (p. 84): Tier III at Priority Level 2, no roll for the
       Tier, when both forces can put a legal army of it on the table. */
    function canStandard(coA, coB) {
      return canFieldArmy(coA, 3, 2, true) && canFieldArmy(coB, 3, 2, true);
    }
    function rollBattleTier(coA, coB, pl) {
      var cap = maxBattleTier(coA, coB, pl), roll = d6();
      var standing = Math.min(5, Math.min(effectiveTier(coA), effectiveTier(coB)));
      return {
        roll: roll, cap: cap, tier: Math.min(roll, cap),
        standing: standing,
        // true when it was the state of the two rosters, not their standing, that held it down
        thin: cap < Math.min(roll, standing)
      };
    }

    function rollScenario(useD3) {
      var roll = useD3 ? d3() : d6();
      return { roll: roll, id: SCENARIOS[roll - 1], name: SCENARIO_NAMES[SCENARIOS[roll - 1]] };
    }
    // how many units may be swapped in the "modify the armies" step (p. 46)
    function swapAllowance(co, listLength) {
      return Math.floor(listLength * (hasDoctrine(co, 'O6') ? 0.5 : 0.25));
    }

    /* ================= payment (p. 84) =================
       Roll BattleTier x PriorityLevel D6 twice. Winner takes the higher total, loser
       the lower, a draw gives both the lower. Tough Negotiators re-rolls up to half
       the dice, rounding up, of its own roll; the second result stands. */
    function rollPayment(battleTier, pl) {
      var n = battleTier * pl, dice = [];
      for (var i = 0; i < n; i++) dice.push(d6());
      return dice;
    }
    function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
    function negotiate(dice) {
      var n = Math.ceil(dice.length / 2), out = dice.slice(), swapped = [];
      // re-roll the lowest dice — the sensible use of the doctrine
      var order = out.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return a.v - b.v; });
      for (var k = 0; k < n; k++) {
        var idx = order[k].i, was = out[idx], now = d6();
        out[idx] = now;
        swapped.push({ was: was, now: now });
      }
      return { dice: out, swapped: swapped };
    }
    /* A tribe is territorial (p. 140): in a scenario with an attacker and a
       defender, once the payment dice are shared out, a winning tribe counts its
       1s and 2s as 3s (1-3 as 4 with Effective Resource Utilisation), and a losing
       tribe counts its 5s and 6s as 4s. */
    function territorial(co, dice, won, lost) {
      if (!co || co.faction !== 'xeno' || (!won && !lost)) return null;
      var out = dice.map(function (v) {
        if (won) return hasDoctrine(co, 'XS2') ? (v <= 3 ? 4 : v) : (v <= 2 ? 3 : v);
        return v >= 5 ? 4 : v;
      });
      return { was: dice.slice(), now: out, total: sum(out), won: !!won };
    }
    /* `preset`: a player's own roll, already made — and already re-rolled or kept
       under Plunderer, which they decide on seeing it — as { dice: {A}, plunder: {A} }. */
    function payment(battleTier, pl, coA, coB, winner, attackDefend, preset) {
      preset = preset || {};
      var pd = preset.dice || {}, pp = preset.plunder || {}, pn = preset.neg || {};
      var a = pd.A || rollPayment(battleTier, pl), b = pd.B || rollPayment(battleTier, pl);
      var negA = null, negB = null, plunder = { A: pp.A || null, B: pp.B || null };
      /* Plunderer (Path of the Villain, p. 112): a victorious revolt "may reroll
         all dice". A player chooses on seeing the roll; a rival re-rolls one that
         came in under the odds. */
      function loot(co, side, dice) {
        if (pd[side] || !hasDoctrine(co, 'V2') || winner !== side) return dice;
        if (sum(dice) >= dice.length * 3.5) { plunder[side] = { was: dice.slice(), kept: true }; return dice; }
        var again = rollPayment(battleTier, pl);
        plunder[side] = { was: dice.slice(), now: again.slice() };
        return again;
      }
      a = loot(coA, 'A', a); b = loot(coB, 'B', b);
      /* Tough Negotiators (p. 87): a player picks which dice to re-roll on seeing
         them (preset.neg); a rival re-rolls its lowest half. */
      if (pd.A) negA = pn.A || null; else if (hasDoctrine(coA, 'S2')) { negA = negotiate(a); a = negA.dice; }
      if (pd.B) negB = pn.B || null; else if (hasDoctrine(coB, 'S2')) { negB = negotiate(b); b = negB.dice; }
      var hi = Math.max(sum(a), sum(b)), lo = Math.min(sum(a), sum(b));
      var out = { diceA: a, diceB: b, negA: negA, negB: negB, plunder: plunder,
        high: hi, low: lo, A: lo, B: lo, extra: { A: null, B: null }, thin: { A: false, B: false } };
      // PR Masters turns its own draw into a victory for payment purposes too
      var wA = winner === 'A' || (winner === null && hasDoctrine(coA, 'S5'));
      var wB = winner === 'B' || (winner === null && hasDoctrine(coB, 'S5'));
      if (wA && !wB) { out.A = hi; out.B = lo; }
      else if (wB && !wA) { out.B = hi; out.A = lo; }
      else if (wA && wB) { out.A = hi; out.B = hi; }
      // which set of dice each side was paid from, for the tribe's recalculation
      if (attackDefend) {
        var hiDice = sum(a) >= sum(b) ? a : b, loDice = hiDice === a ? b : a;
        out.territory = { A: null, B: null };
        [['A', coA, wA && !wB, wB && !wA], ['B', coB, wB && !wA, wA && !wB]].forEach(function (q) {
          var dice = out[q[0]] === hi && q[2] ? hiDice : loDice;
          var t = territorial(q[1], dice, q[2], q[3]);
          if (t) { out.territory[q[0]] = t; out[q[0]] = t.total; }
        });
      }
      /* Rob the Rich gives three quarters of the take away; Unclear Intentions adds
         a quiet D3 a Battle Tier from somebody who would rather not be named. */
      [['A', coA], ['B', coB]].forEach(function (pair) {
        var side = pair[0], co = pair[1];
        if (hasDoctrine(co, 'H5')) {
          var full = out[side];
          out[side] = Math.floor(full * 0.75);
          out.thin[side] = { was: full, now: out[side] };
        }
        if (hasDoctrine(co, 'V6')) {
          var dice = [];
          for (var i = 0; i < battleTier; i++) dice.push(d3());
          var gift = sum(dice);
          out.extra[side] = { dice: dice, total: gift };
          out[side] += gift;
        }
      });
      return out;
    }

    /* ================= experience and trauma (p. 85) ================= */
    /* `line` is a per-unit record from the battle report:
         { rid, side, key, startSize, endSize, destroyed, brokenEver,
           kills: [ {tier, broken} ], wiped, aboardDowned } */
    function expFor(line, ctx) {
      var entry = ctx.entry, p = profile(entry.key), out = [];
      if (p.command) return { total: 0, lines: [{ text: 'Command Units never earn experience.', n: 0 }] };
      if (p.leaderBug) return { total: 0, lines: [{ text: 'Leader Bugs never earn experience.', n: 0 }] };
      if (p.alpha) return { total: 0, lines: [{ text: 'Alpha squads never earn experience.', n: 0 }] };
      if (isTurretP(p)) return { total: 0, lines: [{ text: 'Turrets never earn experience.', n: 0 }] };
      // Drone Control (p. 37): "they do not get any experience during campaigns"
      if (entry.drone) return { total: 0, lines: [{ text: 'Drones never earn experience.', n: 0 }] };
      out.push({ text: 'Took part in the battle', n: 1 });
      if (ctx.enemyTier > ctx.ownTier) out.push({ text: 'Fought a Tier ' + R.ROMAN[ctx.enemyTier] + ' company', n: 1 });
      if (ctx.won) {
        // Viva la Revolution!: three for a win rather than one (p. 111)
        out.push(hasDoctrine(ctx.company, 'H1')
          ? { text: 'Viva la Revolution! — the revolt won', n: 3 }
          : { text: 'The ' + words(ctx.company).force.toLowerCase() + ' won', n: 1 });
      }
      // Rob the Rich, Give to the Poor: less money, more experience
      if (hasDoctrine(ctx.company, 'H5')) out.push({ text: 'Rob the Rich, Give to the Poor', n: 2 });
      (line.kills || []).forEach(function (k) {
        if (k.tier > p.tier) out.push({ text: 'Broke a Tier ' + R.ROMAN[k.tier] + ' unit', n: 2 });
        else if (k.tier === p.tier) out.push({ text: 'Broke a Tier ' + R.ROMAN[k.tier] + ' unit', n: 1 });
      });
      return { total: sum(out.map(function (o) { return o.n; })), lines: out };
    }

    function tpFor(line, ctx) {
      var entry = ctx.entry, p = profile(entry.key), out = [];
      if (!takesHonours(p)) return { total: 0, lines: [{ text: 'Machines take no Trauma Points.', n: 0 }] };
      if (p.command) return { total: 0, lines: [{ text: 'Command Units take no Trauma Points.', n: 0 }] };
      if (p.leaderBug) return { total: 0, lines: [{ text: 'Leader Bugs take no Trauma Points.', n: 0 }] };
      if (p.alpha) return { total: 0, lines: [{ text: 'Alpha squads take no Trauma Points.', n: 0 }] };
      // "Drone units do not get any Experience and Trauma points during campaigns" (p. 40)
      if (entry.drone) return { total: 0, lines: [{ text: 'Drones take no Trauma Points.', n: 0 }] };
      // To Hell and Back!: the fighters do not hold being broken against themselves
      if (line.brokenEver && !hasDoctrine(ctx.company, 'H4')) out.push({ text: 'Was broken at least once', n: 2 });
      // Stairs to Heaven: the Holy Warriors' dead are already where they wanted to go
      var martyrs = hasDoctrine(ctx.company, 'P3') && p.group === 'Holy Warriors';
      var lost = Math.max(0, line.startSize - line.endSize);
      /* Endless Tide (p. 124): a swarm that digs its dead back up still felt them go.
         One point the first time it lost a bug, four the first time it was ever
         below half — whatever it had grown back to by the end. */
      if (R.has({ rules: p.rules }, 'Endless Tide') && line.minSize != null) {
        var low = Math.max(0, line.startSize - line.minSize);
        if (low > line.startSize / 2) out.push({ text: 'Endless Tide — was cut below half', n: 4 });
        else if (low >= 1) out.push({ text: 'Endless Tide — lost bugs', n: 1 });
        lost = 0;
      }
      if (martyrs && lost) out.push({ text: 'Stairs to Heaven — their losses cost them nothing', n: 0 });
      else if (lost > line.startSize / 2) out.push({ text: 'Lost more than half its soldiers', n: 4 });
      else if (lost >= 1) out.push({ text: 'Lost ' + lost + ' soldier' + (lost > 1 ? 's' : ''), n: 1 });
      if (ctx.lost) out.push({ text: 'The company lost the battle', n: 1 });
      if (ctx.routed && !hasDoctrine(ctx.company, 'S5')) out.push({ text: 'The army was routed', n: 1 });
      if (ctx.consecutive) out.push({ text: 'A second battle in a row', n: 1 });
      if (line.aboardDowned) out.push({ text: 'Was aboard an aircraft that was shot down', n: 5 });
      // Drug Dealer: whatever they were given, they pay for afterwards
      if (line.drugged) out.push({ text: 'Drug Dealer — the comedown', n: d6() + 1 });
      var tot = sum(out.map(function (o) { return o.n; }));
      // Degenerated Genotype: double Trauma Points
      if (hasTraumaFlag(entry, 'doubleTP') && tot) { out.push({ text: (isXenoKey(entry.key) ? 'Infamy of Defeatism' : 'Degenerated Genotype') + ' — doubled', n: tot }); tot *= 2; }
      return { total: tot, lines: out };
    }

    function traumaThreshold(co) { return hasDoctrine(co, 'S3') ? 15 : 10; }
    /* Roll a trauma the unit does not already have. Returns null if it has them all. */
    function rollTrauma(entry) {
      var T = traumaTable(entry.key), p = profile(entry.key);
      // Reduced Intelligence cannot befall an Overgrown bug: re-roll it (p. 125)
      function can(t) { return entry.traumas.indexOf(t.n) < 0 && !(t.noOvergrown && R.isOvergrown(p)); }
      var left = T.filter(can);
      if (!left.length) return null;
      for (var guard = 0; guard < 200; guard++) {
        var n = d10();
        if (can(T[n - 1])) return T[n - 1];
      }
      return pick(left);
    }

    /* ================= salvage (p. 86) ================= */
    function salvage(line, entry, won) {
      var p = profile(entry.key), need, note;
      // an Overgrown bug is a creature, not a hull: there is nothing to recover
      if (p.faction === 'bugs') return { roll: null, saved: false, need: null, note: 'A dead Overgrown bug is a carcass, not a wreck.' };
      // drop pods and turrets are never salvaged (pp. 86, 140) — they cost nothing to replace
      if (p.noSlot) return { roll: null, saved: false, need: null, note: 'A drop pod is not salvaged once used.' };
      if (isTurretP(p)) return { roll: null, saved: false, need: null, note: 'A turret is not salvaged.' };
      if (p.cls === 'aircraft') {
        need = (entry.upgrades || []).indexOf(1) >= 0 ? 2 : 4;   // Advanced Emergency Systems
        note = 'Aircraft make an emergency landing on a ' + need + '+' +
          (need === 2 ? ' with Advanced Emergency Systems.' : '.');
      } else if (line.catastrophic) {
        // a ground vehicle, crewed or a drone, blown apart is gone (p. 86)
        return { roll: null, saved: false, need: null, note: 'Destroyed in a catastrophic explosion — nothing is left to recover.' };
      } else if (entry.drone) {
        need = won ? 3 : 5;
        note = 'A drone is recovered on a ' + need + '+.';
      } else {
        need = won ? 3 : 5;
        note = 'A ground vehicle is recovered on a ' + need + '+.';
      }
      var roll = d6();
      return { roll: roll, need: need, saved: roll >= need, note: note };
    }

    /* The Trauma Points each of a side's units earned in the battle, rolled once
       — No Place for the Weak! is decided on them, and the aftermath reuses them. */
    function rollTP(campaign, report, side) {
      var co = campaign.companies[side], foe = campaign.companies[side === 'A' ? 'B' : 'A'];
      var won = report.winner === side || (report.winner === null && hasDoctrine(co, 'S5'));
      var lostBattle = report.winner && report.winner !== side;
      var rolled = {};
      (report.units || []).filter(function (l) { return l.side === side; }).forEach(function (line) {
        var e = byRid(co, line.rid);
        if (!e) return;
        rolled[e.rid] = tpFor(line, {
          entry: e, company: co, won: won, lost: !!lostBattle,
          ownTier: co.tier, enemyTier: foe.tier, halveTP: false,
          routed: !!report.routed && report.routed[side],
          consecutive: e.lastBattle === campaign.turn && campaign.turn > 0
        });
      });
      return rolled;
    }
    /* "the unit which got the most Trauma Points (if there are two or more such
       units, the player selects only one of them)" (p. 112): every infantry unit
       tied for the most, the leader aside. */
    function weakCandidates(campaign, side, rolled) {
      var co = campaign.companies[side], best = 0, out = [];
      Object.keys(rolled).forEach(function (id) {
        var e = byRid(co, id);
        if (!e || e.rid === co.cmdRid || profile(e.key).cls !== 'infantry') return;
        var n = rolled[id].total;
        if (n > best) { best = n; out = [e]; } else if (n === best && n > 0) out.push(e);
      });
      return best > 0 ? out : [];
    }

    /* Enhanced Genetic Memory, taken up by a player for one offered unit: the new
       recruit is paid for, and on a 2-6 it remembers everything the lost one had
       before its last battle. */
    function rebirth(co, offer) {
      if (!offer || offer.done) return { ok: false, why: 'Already decided.' };
      if (co.kUC < offer.cost) return { ok: false, why: 'Costs ' + offer.cost + ' ' + money(co) + ' — the tribe has ' + co.kUC + '.' };
      co.kUC -= offer.cost;
      var ne = newEntry(offer.key), mem = offer.mem, r2 = d6();
      if (mem && r2 >= 2) {
        ne.exp = mem.exp; ne.tp = mem.tp; ne.honours = mem.honours.slice(); ne.traumas = mem.traumas.slice();
        ne.name = mem.name;
        ne.history.push('Reborn with the memory of ' + mem.name + ' (Enhanced Genetic Memory, D6 ' + r2 + ').');
      } else ne.history.push('Recruited in place of ' + offer.name + ' — the memory did not carry (D6 ' + r2 + ').');
      co.roster.push(ne);
      offer.done = { roll: r2, remembered: !!(mem && r2 >= 2), name: ne.name };
      return { ok: true, roll: r2, remembered: offer.done.remembered };
    }

    return {
      fieldableTier: fieldableTier, maxBattleTier: maxBattleTier, levelsFor: levelsFor,
      canStandard: canStandard, rollBattleTier: rollBattleTier, rollScenario: rollScenario,
      swapAllowance: swapAllowance, rollPayment: rollPayment, sum: sum, negotiate: negotiate,
      territorial: territorial, payment: payment, expFor: expFor, tpFor: tpFor,
      traumaThreshold: traumaThreshold, rollTrauma: rollTrauma, salvage: salvage, rollTP: rollTP,
      weakCandidates: weakCandidates, rebirth: rebirth
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCCampContract;
})(typeof window !== 'undefined' ? window : global);
