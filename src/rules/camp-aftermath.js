/* PMC 2670 — Firefight : after the battle: experience, casualties, honours and traumas, payment and salvage, and the battles fought elsewhere

   Made once by campaign.js, the first time it is wanted, with E: the names
   of campaign.js this needs, bound here once. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCCampAftermath = function (E) {
    var ATTACK_DEFEND = E.ATTACK_DEFEND, R = E.R, SCENARIOS = E.SCENARIOS, addLoss = E.addLoss,
        biomassTally = E.biomassTally, byRid = E.byRid, canFieldArmy = E.canFieldArmy, d3 = E.d3, d6 = E.d6,
        developRival = E.developRival, expFor = E.expFor, hasDoctrine = E.hasDoctrine,
        hasTraumaFlag = E.hasTraumaFlag, isLeaderP = E.isLeaderP, manned = E.manned,
        newCompany = E.newCompany, newEntry = E.newEntry, payment = E.payment, pick = E.pick,
        poolOf = E.poolOf, poolsFor = E.poolsFor, profile = E.profile, recruitCost = E.recruitCost,
        rollTP = E.rollTP, rollTrauma = E.rollTrauma, salvage = E.salvage, shuffle = E.shuffle,
        tpFor = E.tpFor, traumaTable = E.traumaTable, traumaThreshold = E.traumaThreshold,
        weakCandidates = E.weakCandidates, weightOf = E.weightOf;

    /* ================= the aftermath =================
       Takes a battle report and applies every book step in order, returning a
       record of what happened so the UI can show it and the player can see why. */
    /* `opts` carries the choices a player made after the battle, before this runs:
       their pay roll under Plunderer (dice, plunder), and under No Place for the
       Weak! the Trauma Points already rolled (tp) and who, if anyone, was
       executed (weak: a rid, or false). A side with nothing in it is decided here. */
    function aftermath(campaign, report, opts) {
      opts = opts || {};
      var out = { turn: campaign.turn + 1, winner: report.winner, sides: {}, payment: null };
      var coA = campaign.companies.A, coB = campaign.companies.B;

      out.payment = payment(report.battleTier, report.pl, coA, coB, report.winner,
        report.attackDefend != null ? report.attackDefend : ATTACK_DEFEND.indexOf(report.scenario) >= 0,
        { dice: opts.dice, plunder: opts.plunder, neg: opts.neg });
      coA.kUC += out.payment.A;
      coB.kUC += out.payment.B;

      ['A', 'B'].forEach(function (side) {
        var co = campaign.companies[side], foe = campaign.companies[side === 'A' ? 'B' : 'A'];
        var won = report.winner === side || (report.winner === null && hasDoctrine(co, 'S5'));
        var lostBattle = report.winner && report.winner !== side;
        var rec = { side: side, kUC: out.payment[side], units: [], gone: [], salvaged: [],
          traumas: [], executed: null };

        /* The models this side lost, unit by unit: a named soldier is one and a
           swarm's count is what it says. A drone or a turret has nobody in it,
           and is not a loss. */
        var keyOf = {}, lostBy = {};
        (report.units || []).forEach(function (l) { if (l.side === side) keyOf[l.rid] = l.key; });
        (report.casualties || []).forEach(function (c) {
          if (c.side !== side) return;
          var n = c.count || 1, p = profile(keyOf[c.rid]);
          lostBy[c.rid] = (lostBy[c.rid] || 0) + n;
          if (!c.swarm) addLoss(co, p ? poolOf(p) : poolsFor(co)[0], 'lost', n * (p ? weightOf(p) : 1));   // the swarm's is its biomass tally
        });
        // a unit that leaves the books takes its survivors with it
        function leaves(e) {
          var p = profile(e.key), left = Math.max(0, manned(e, co) - (lostBy[e.rid] || 0));
          addLoss(co, poolOf(p), 'departed', left * weightOf(p));
        }

        /* No Place for the Weak! (p. 112). The example is made of whichever unit
           came back carrying the most Trauma Points from this battle, so the day's
           points are rolled first, once, and kept — the main pass reuses them
           rather than rolling again. That execution is what buys everyone else the
           halving. */
        /* Infamy of Degeneration (p. 143): rolled after the unit had its chance to
           spend — which is to say, now, before this battle's EXP lands. */
        rec.degenerated = [];
        co.roster.forEach(function (e) {
          if (!hasTraumaFlag(e, 'degeneration') || !e.exp) return;
          var dr = d6();
          if (dr >= 5) { rec.degenerated.push({ rid: e.rid, name: e.name, lost: e.exp, roll: dr }); e.history.push('Infamy of Degeneration — lost ' + e.exp + ' unspent EXP.'); e.exp = 0; }
        });
        /* Enhanced Genetic Memory needs the unit as it was before this battle. */
        var before = {};
        if (hasDoctrine(co, 'XS5')) {
          co.roster.forEach(function (e) {
            before[e.rid] = { exp: e.exp, tp: e.tp, honours: e.honours.slice(), traumas: e.traumas.slice(), name: e.name };
          });
        }
        var rolled = (opts.tp && opts.tp[side]) || rollTP(campaign, report, side), halveTP = false;
        var choice = opts.weak && side in opts.weak ? opts.weak[side] : undefined;
        if (hasDoctrine(co, 'V5') && choice !== false) {
          // the player named the unit; left to itself, the force makes an example of the worst
          var cand = weakCandidates(campaign, side, rolled);
          var worst = choice ? byRid(co, choice) : (cand[0] || null);
          var worstN = worst && rolled[worst.rid] ? rolled[worst.rid].total : 0;
          if (worst && worstN > 0) {
            halveTP = true;
            rec.executed = { rid: worst.rid, name: worst.name, key: worst.key, tp: worstN };
            worst.history.push('Executed for coming back in the worst state of the force.');
            co.roster = co.roster.filter(function (x) { return x !== worst; });
            leaves(worst);
          }
        }

        /* Machines first, so a passenger's fate can read whether the aircraft it
           was riding in came home. */
        var salvaged = {}, salvageOf = {};
        (report.units || []).filter(function (l) {
          return l.side === side && l.destroyed;
        }).forEach(function (line) {
          var e = byRid(co, line.rid);
          if (!e || profile(e.key).cls === 'infantry') return;
          var sv = salvage(line, e, won || report.winner === null);
          salvageOf[e.rid] = sv;
          if (sv.saved) salvaged[e.rid] = 1;
        });

        var fielded = {};
        (report.units || []).filter(function (l) { return l.side === side; }).forEach(function (line) {
          var entry = byRid(co, line.rid);
          if (!entry) return;
          fielded[entry.rid] = 1;
          var ctx = {
            entry: entry, company: co, won: won, lost: !!lostBattle,
            ownTier: co.tier, enemyTier: foe.tier, halveTP: halveTP,
            routed: !!report.routed && report.routed[side],
            consecutive: entry.lastBattle === campaign.turn && campaign.turn > 0
          };
          var exp = expFor(line, ctx);
          var tp = rolled[entry.rid] || tpFor(line, ctx);
          delete entry.drugged;                       // spent — chosen again next battle
          if (halveTP && tp.total > 0) {
            var half = Math.floor(tp.total / 2);
            tp = {
              total: half,
              lines: tp.lines.concat([{ text: 'No Place for the Weak! — halved, ' + tp.total + ' to ' + half, n: half - tp.total }])
            };
          }
          entry.exp += exp.total;
          entry.tp += tp.total;
          entry.lastBattle = out.turn;

          var u = { rid: entry.rid, name: entry.name, key: entry.key, exp: exp, tp: tp, wiped: false, salvage: null, trauma: null };

          /* The unit's casualties go on its record by name, and the survivors
             march on with it: the gaps are filled with fresh recruits when it is
             next mustered. */
          var cas = (report.casualties || []).filter(function (c) { return c.side === side && c.rid === line.rid; });
          if (cas.length) {
            u.casualties = cas;
            var mass = cas.reduce(function (n, c) { return n + (c.mass != null ? c.mass : c.count); }, 0);
            var bodies = cas.reduce(function (n, c) { return n + (c.count || 0); }, 0);
            entry.history.push(cas[0].swarm ? (mass ? 'Biomass lost: ' + mass + '.' : 'Lost ' + bodies + '.')
              : cas[0].anon ? 'Lost ' + bodies + ' Esh-Aven.'
              : 'Casualties: ' + cas.map(function (c) { return c.rank + ' ' + c.name; }).join(', ') + '.');
          }
          if (line.men) entry.men = line.men.slice();

          /* Losses (p. 85): survivors are replaced free, and only a unit wiped out
             — every soldier killed — comes off the dossier. A unit that scattered
             and fled the field still has men, and is back for the next battle.
             The free field command is the exception even when it is wiped: it is
             the company itself, and the book hands it back at the Company Tier
             rather than ending the campaign. */
          if (line.fled) u.fled = true;
          if (line.aboardDowned) {
            /* Aboard a machine that went down. A downed aircraft makes an emergency
               landing on a 4+ and its passengers survive with 5 Trauma Points
               (p. 86); if it was not recovered, neither were they. */
            u.aboardDowned = true;
            u.aircraftSaved = !!salvaged[line.lostAboard];
            if (!u.aircraftSaved) { u.wiped = true; rec.gone.push(entry); }
          } else if (line.wiped && entry.rid === co.cmdRid) {
            u.rebuilt = true;
            entry.history.push('The field command was wiped out and reconstituted.');
          } else if (line.wiped && entry.drone && profile(entry.key).cls === 'infantry') {
            // a destroyed Drone unit can be salvaged, as a drone hull can (p. 40)
            var svD = salvageOf[entry.rid] || salvage(line, entry, won || report.winner === null);
            u.salvage = svD;
            if (svD.saved) { entry.restUntil = 1; rec.salvaged.push(entry); }
            else { u.wiped = true; rec.gone.push(entry); }
          } else if (line.wiped && (profile(entry.key).cls === 'infantry' || profile(entry.key).faction === 'bugs')) {
            u.wiped = true;
            rec.gone.push(entry);
          } else if (line.destroyed && profile(entry.key).cls !== 'infantry') {
            var sv = salvageOf[entry.rid] || salvage(line, entry, won || report.winner === null);
            u.salvage = sv;
            // it skips the next battle (p. 86): one spell in the workshop, counted down by the next aftermath
            if (sv.saved) { entry.restUntil = 1; rec.salvaged.push(entry); }
            else { u.wiped = true; rec.gone.push(entry); }
          }

          // the trauma threshold, checked after the points land
          var need = traumaThreshold(co);
          while (!u.wiped && entry.tp >= need && entry.traumas.length < 10) {
            var t = rollTrauma(entry);
            entry.tp -= need;
            if (!t) break;
            entry.traumas.push(t.n);
            entry.history.push('Suffered ' + t.name + '.');
            // Atavism: every Adaptation it had grown is lost
            if (t.flag === 'atavism' && entry.honours.length) { entry.honours = []; entry.history.push('Atavism — lost every Adaptation.'); }
            u.trauma = t;
            rec.traumas.push({ rid: entry.rid, name: entry.name, trauma: t });
            if (entry.traumas.length >= 10) { u.wiped = true; u.disbanded = true; rec.gone.push(entry); }
          }
          // where the ledger leaves it, so the aftermath can show the running total
          u.expNow = entry.exp;
          u.tpNow = entry.tp;
          u.tpCap = traumaThreshold(co);
          rec.units.push(u);
        });

        /* "If a unit does not take part in a battle, it removes D3+1 TPs, as it has
           time for rest and recovery" (p. 85). A machine recovered from the last
           battle also works off its spell in the workshop here. */
        co.roster.forEach(function (e) {
          if (fielded[e.rid]) return;
          if (e.restUntil > 0) e.restUntil--;
          var roll = d3() + 1, shed = Math.min(e.tp, roll);
          e.tp -= shed;
          // Supportive Community (p. 141): a rested unit may put an Infamy behind it
          var healed = null;
          if (hasDoctrine(co, 'XS3') && e.traumas.length) {
            var sr = d6();
            if (sr === 6) {
              var gone2 = e.traumas.splice(Math.floor(Math.random() * e.traumas.length), 1)[0];
              healed = traumaTable(e.key)[gone2 - 1];
              e.history.push('Supportive Community — ' + healed.name + ' is behind it.');
              (rec.healed = rec.healed || []).push({ rid: e.rid, name: e.name, trauma: healed });
            }
          }
          rec.units.push({
            rid: e.rid, name: e.name, key: e.key, rested: shed, restRoll: roll,
            tpNow: e.tp, tpCap: traumaThreshold(co),
            workshop: e.restUntil > 0 ? e.restUntil : 0
          });
        });

        rec.gone.forEach(function (e) {
          co.roster = co.roster.filter(function (x) { return x !== e; });
          leaves(e);
        });

        /* Enhanced Genetic Memory (p. 141): a destroyed infantry unit comes back as
           a new recruit of the same kind, and on a 2-6 it remembers everything it
           had before this battle. The recruit is paid for as usual. */
        if (hasDoctrine(co, 'XS5') && opts.askReborn && opts.askReborn[side]) {
          /* A player "can recruit" each one (p. 141): offered on the aftermath
             screen, and only there — it is gone once the next contract is taken. */
          rec.rebornOffer = [];
          rec.gone.forEach(function (e) {
            var p0 = profile(e.key);
            if (!p0 || p0.cls !== 'infantry' || isLeaderP(p0) || e.rid === co.cmdRid) return;
            rec.rebornOffer.push({ rid: e.rid, name: e.name, key: e.key, cost: recruitCost(co, e.key), mem: before[e.rid] || null, done: null });
          });
        } else if (hasDoctrine(co, 'XS5')) {
          rec.reborn = [];
          rec.gone.forEach(function (e) {
            var p0 = profile(e.key);
            if (!p0 || p0.cls !== 'infantry' || isLeaderP(p0) || e.rid === co.cmdRid) return;
            var cost = recruitCost(co, e.key);
            if (co.kUC < cost) { rec.reborn.push({ name: e.name, key: e.key, afford: false, cost: cost }); return; }
            co.kUC -= cost;
            var ne = newEntry(e.key), mem = before[e.rid], r2 = d6();
            if (mem && r2 >= 2) {
              ne.exp = mem.exp; ne.tp = mem.tp; ne.honours = mem.honours.slice(); ne.traumas = mem.traumas.slice();
              ne.name = mem.name;
              ne.history.push('Reborn with the memory of ' + mem.name + ' (Enhanced Genetic Memory, D6 ' + r2 + ').');
            } else ne.history.push('Recruited in place of ' + e.name + ' — the memory did not carry (D6 ' + r2 + ').');
            co.roster.push(ne);
            rec.reborn.push({ name: ne.name, key: e.key, afford: true, cost: cost, roll: r2, remembered: !!(mem && r2 >= 2) });
          });
        }

        /* The swarm feeds (p. 124). Alternate Carbon-based Metabolism turns every
           enemy unit destroyed in an assault into a Resource Point; Fungi Symbiosis
           turns every human one into a new unit of Infected Humans. */
        if (co.faction === 'bugs') {
          var ak = 0, ah = 0;
          (report.units || []).forEach(function (l) {
            if (l.side !== side) return;
            ak += l.assaultKills || 0; ah += l.assaultKillsHuman || 0;
          });
          if (ak && hasDoctrine(co, 'BC1')) {
            co.kUC += ak; rec.kUC += ak;
            rec.feeding = { rp: ak, text: 'Alternate Carbon-based Metabolism: ' + ak + ' enemy unit' + (ak === 1 ? '' : 's') +
              ' devoured in assaults — +' + ak + ' RP.' };
          }
          if (ah && hasDoctrine(co, 'BP4')) {
            rec.infected = [];
            for (var fi = 0; fi < ah; fi++) {
              var ne = newEntry('binfected');
              ne.history.push('Rose from a human unit the swarm destroyed (Fungi Symbiosis).');
              co.roster.push(ne);
              rec.infected.push(ne);
            }
          }
        }

        /* The memorial: every soldier the force has lost, battle by battle, kept
           for the whole campaign — including those of units that are gone. */
        co.memorial = co.memorial || [];
        (report.casualties || []).filter(function (c) { return c.side === side; }).forEach(function (c) {
          // the swarm keeps a tally of biomass by kind of bug instead of names
          if (c.swarm) {
            var tally = co.biomass = biomassTally(co);
            var t = tally[c.type] || (tally[c.type] = { models: 0, mass: 0 });
            t.models += c.count;
            return;
          }
          // the Esh-Aven go on it unnamed, as a count for the unit
          if (c.anon) {
            co.memorial.push({ anon: true, count: c.count, type: c.type, unit: c.unit, battle: out.turn, against: foe.name, scenario: report.scenario });
            return;
          }
          co.memorial.push({
            name: c.name, rank: c.rank, type: c.type, unit: c.unit, turn: c.turn,
            battle: out.turn, against: foe.name, scenario: report.scenario
          });
        });

        co.record.battles++;
        if (report.winner === side) co.record.wins++;
        else if (report.winner === null) co.record.draws++;
        else co.record.losses++;

        out.sides[side] = rec;
      });

      campaign.turn = out.turn;
      campaign.log.push({
        turn: out.turn, scenario: report.scenario, tier: report.battleTier, pl: report.pl,
        winner: report.winner, kUC: { A: out.payment.A, B: out.payment.B },
        against: coB.name
      });
      if (campaign.log.length > 40) campaign.log.shift();
      /* A rival keeps its own record of the battles it fought — against the
         player, or off the table against another force — for its dossier. */
      [['A', coA, coB], ['B', coB, coA]].forEach(function (t) {
        var co = t[1];
        if (!co || !co.archetype) return;
        co.log = co.log || [];
        co.log.push({ turn: out.turn, scenario: report.scenario, tier: report.battleTier, pl: report.pl,
          vs: t[2].name, result: report.winner === t[0] ? 'won' : report.winner ? 'lost' : 'drawn', kUC: out.payment[t[0]] });
        if (co.log.length > 20) co.log.shift();
      });

      /* The forces that sat this one out were fighting somebody else — each
         other, two by two, and the odd one out the locals. Their battles are
         played on paper, and go through the same aftermath as yours: experience,
         trauma, losses and the pay, which they then spend. */
      var pairs = elsewherePairs(campaign, coB);
      out.elsewhere = [];
      /* Asked to (opts.defer), the pairs are handed back instead, to be fought out
         on a table nobody sees (engine/offtable.js) and settled one at a time. */
      if (opts && opts.defer) { out.pairs = pairs; return out; }
      pairs.forEach(function (pr) {
        out.elsewhere = out.elsewhere.concat(battleElsewhere(campaign, campaign.rivals[pr[0]], pr[1] == null ? null : campaign.rivals[pr[1]]));
      });
      return out;
    }
    // the forces that sat this battle out, two by two (and the odd one out alone), as indices into the rivals
    function elsewherePairs(campaign, coB) {
      var idle = shuffle((campaign.rivals || []).map(function (co, i) { return i; })
        .filter(function (i) { return campaign.rivals[i] !== coB && i !== campaign.facing; }));
      var pairs = [];
      while (idle.length) { var x = idle.shift(); pairs.push([x, idle.length ? idle.shift() : null]); }
      return pairs;
    }

    /* ---- a battle fought off the table ----
       Nobody sees it, so it is rolled rather than played: who won, weighted by
       Company Tier; then, unit by unit, how many it lost — more on the losing
       side — and now and then a unit wiped out or a machine knocked out. That is
       turned into the same report a battle on the table hands back, and the
       book's aftermath does the rest. */
    function paperUnit(e) {
      var p = profile(e.key);
      return { key: e.key, name: e.name, faction: p.faction, tier: p.tier, group: p.group, cls: p.cls,
        command: !!p.command, rules: p.rules, models: R.isMachine(p) ? 1 : p.size, drone: !!e.drone };
    }
    // the phantom the odd force out fights: whoever holds that part of the world
    function locals(co) {
      var foe = newCompany(co.faction === 'rebel' ? 'Garrison forces' : 'Local militia', { faction: co.faction === 'rebel' ? 'pmc' : 'rebel' });
      foe.tier = co.tier;
      foe.phantom = true;
      return foe;
    }
    function paperBattle(coA, coB) {
      var tier = Math.max(1, Math.min(coA.tier, coB.tier));
      var edge = 0.5 + 0.12 * (coA.tier - coB.tier);
      var roll = Math.random();
      var winner = roll < 1 / 8 ? null : roll < 1 / 8 + (7 / 8) * Math.max(0.15, Math.min(0.85, edge)) ? 'A' : 'B';
      var report = { winner: winner, battleTier: tier, pl: 1, scenario: pick(SCENARIOS), attackDefend: false,
        routed: { A: false, B: false }, turns: 5, units: [], casualties: [], paper: true };
      var taken = {}, byside = { A: [], B: [] };
      ['A', 'B'].forEach(function (side) {
        var co = side === 'A' ? coA : coB;
        if (co.phantom) return;
        var lost = winner && winner !== side, won = winner === side;
        // who took the field: the command, and up to seven more not in the workshop
        var ready = co.roster.filter(function (e) { return !(e.restUntil > 0) && e.rid !== co.cmdRid; });
        var fielded = co.roster.filter(function (e) { return e.rid === co.cmdRid; }).concat(shuffle(ready).slice(0, 7));
        fielded.forEach(function (e) {
          var u = paperUnit(e), p = profile(e.key), machine = R.isMachine(p);
          R.musterMen(u, e.men, taken);
          var start = u.models, frac = lost ? 0.15 + Math.random() * 0.55 : won ? Math.random() * 0.35 : Math.random() * 0.5;
          var gone = Math.random() < (lost ? 0.12 : 0.04);
          var end = machine ? (gone ? 0 : 1) : gone && e.rid !== co.cmdRid ? 0 : Math.max(1, start - Math.round(start * frac));
          u.models = end;
          R.syncMen(u, 1 + Math.floor(Math.random() * 5), taken);
          var line = {
            rid: e.rid, side: side, key: e.key, tier: p.tier, startSize: start, endSize: end,
            destroyed: machine && end === 0, catastrophic: false, brokenEver: Math.random() < (lost ? 0.4 : 0.15),
            wiped: !machine && end <= 0, fled: false, aboardDowned: false, lostAboard: null, drugged: !!e.drugged,
            minSize: machine ? null : end, assaultKills: 0, assaultKillsHuman: 0,
            men: R.survivors(u), kills: []
          };
          report.units.push(line);
          byside[side].push(line);
          if (R.counted(u)) {
            if (start > end) {
              var c = { side: side, count: start - end, type: p.name, unit: e.name, rid: e.rid, turn: 0 };
              if (p.faction === 'bugs') { c.swarm = true; c.mass = (start - end) * R.biomassOf(p); } else c.anon = true;
              report.casualties.push(c);
            }
          } else {
            (u.men || []).forEach(function (m) {
              if (m.lost == null) return;
              report.casualties.push({ side: side, name: m.name, rank: m.rank, turn: m.lost, type: p.name, unit: e.name, rid: e.rid });
            });
          }
        });
      });
      // a unit broken or wiped out was somebody's doing: the credit goes to one of the other side's
      ['A', 'B'].forEach(function (side) {
        var mine = byside[side === 'A' ? 'B' : 'A'];
        if (!mine.length) return;
        byside[side].forEach(function (l) {
          if (!(l.brokenEver || l.wiped || l.destroyed)) return;
          pick(mine).kills.push({ tier: l.tier, broken: l.brokenEver, key: l.key });
        });
      });
      return report;
    }
    /* One battle among the other forces, settled: `played` is the report of a
       battle actually fought out between them (engine/offtable.js), with x as
       side A; without one it is rolled on paper. */
    function battleElsewhere(campaign, x, y, played) {
      var foe = y || locals(x);
      var mini = { companies: { A: x, B: foe }, turn: campaign.turn - 1, log: [], mode: 'solo' };
      var report = played || paperBattle(x, foe);
      var res = aftermath(mini, report, {});
      var brief = briefOf(report, x, foe);
      function summary(co, side) {
        var r = res.sides[side];
        var sum0 = {
          name: co.name, vs: side === 'A' ? foe.name : x.name,
          result: report.winner === side ? 'won' : report.winner ? 'lost' : 'drew',
          kUC: r.kUC, fell: report.casualties.filter(function (c) { return c.side === side; })
            .reduce(function (n, c) { return n + (c.count || 1); }, 0),
          gone: r.gone.map(function (e) { return e.name; }),
          traumas: r.traumas.length,
          exp: r.units.reduce(function (n, u) { return n + (u.exp ? u.exp.total : 0); }, 0),
          tp: r.units.reduce(function (n, u) { return n + (u.tp ? u.tp.total : 0); }, 0),
          traumaList: r.traumas.map(function (t) { return { unit: t.name, name: t.trauma && t.trauma.name }; }),
          did: developRival(co),
          battle: brief
        };
        return sum0;
      }
      var out = [summary(x, 'A')];
      if (y) out.push(summary(y, 'B'));
      return out;
    }

    /* What the report screen tells of a battle among the other forces: where,
       who won, how long it lasted, and unit by unit what each side took in and
       brought out. */
    function briefOf(report, x, foe) {
      function unitName(co, rid) { var e = (co.roster || []).filter(function (r) { return r.rid === rid; })[0]; return e ? e.name : null; }
      return {
        scenario: report.scenario, tier: report.battleTier, pl: report.pl, turns: report.turns, planet: report.planet || null,
        paper: !!report.paper, text: report.text || null,
        winner: report.winner === 'A' ? x.name : report.winner === 'B' ? foe.name : null,
        sides: ['A', 'B'].map(function (sd) {
          var co = sd === 'A' ? x : foe;
          return {
            name: co.name, faction: co.faction || 'pmc',
            units: (report.units || []).filter(function (l) { return l.side === sd; }).map(function (l) {
              var p = profile(l.key) || {};
              return { name: unitName(co, l.rid) || p.name || l.key, type: p.name || l.key, start: l.startSize, end: l.endSize,
                lost: !!(l.wiped || l.destroyed), fled: !!l.fled, kills: (l.kills || []).length };
            }),
            fell: (report.casualties || []).filter(function (c) { return c.side === sd; }).reduce(function (n, c) { return n + (c.count || 1); }, 0)
          };
        })
      };
    }

    /* After losses, a player unable to field a legal army must rebuild from the
       lowest Tiers up (p. 85). This says what is missing. */
    function rebuildNeeds(co) {
      var gaps = [];
      for (var t = 1; t <= co.tier; t++) {
        if (!canFieldArmy(co, t, 1)) gaps.push(t);
      }
      return gaps;
    }

    return {
      aftermath: aftermath, rebuildNeeds: rebuildNeeds, battleElsewhere: battleElsewhere, elsewherePairs: elsewherePairs
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCCampAftermath;
})(typeof window !== 'undefined' ? window : global);
