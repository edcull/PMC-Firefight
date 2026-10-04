/* PMC 2670 — Firefight : the contract: the offers, picking the force, orders, the auto-pick and starting the battle

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierContract = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, armyPill = E.armyPill, close = E.close,
        colourFlash = E.colourFlash, colourOf = E.colourOf, esc = E.esc, note = E.note, profile = E.profile,
        quietTip = E.quietTip, root = E.root, save = E.save, spellOut = E.spellOut, statRow = E.statRow,
        stripe = E.stripe, tip = E.tip;
    /* ================= the contract ================= */
    /* ================= the contracts on offer =================
       Three forces are on this world, and three jobs are on the table. Each names
       the enemy, how they fight, what the fighting is for and — where the scenario
       has an attacker and a defender — which of the two you would be. What it does
       not name is a single unit of theirs: you learn that when they arrive.

       The offers are rolled once a campaign turn and kept, so leaving the screen
       and coming back cannot be used to fish for an easier job. */
    // the world a job is fought on, as a pill (an offer from before planets were rolled has none)
    var PLANET_NAMES = { desert: 'Desert world', arctic: 'Arctic world', sparse: 'Temperate world', dense: 'Colonised world',
      industrial: 'Industrial world', jungle: 'Jungle world', mountain: 'Mountain world', unstable: 'Unstable world' };
    function planetPill(k) {
      if (!k) return '<span class="mk planetpill">World rolled at the battle</span>';
      return '<span class="mk planetpill planet-' + k + '">' + esc(PLANET_NAMES[k] || k) + '</span>';
    }
    function offersView() {
      var offers = C.rollOffers(E.camp);
      var h = '<h2>Contracts on offer</h2>';
      offers.forEach(function (o, i) { h += offerPanel(o, i); });
      h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
      return h;
    }

    function offerPanel(o, i) {
      var co = (E.camp.rivals || [E.camp.companies.B])[o.rival] || E.camp.companies.B;
      var SC = root.PMCScen, sc = SC && SC.SCENARIOS[o.scenario.id];
      var creedName = co.faction === 'rebel' ? 'Paths' : co.faction === 'bugs' ? 'Evolutionary Pathways' : co.faction === 'xeno' ? 'Tribe Advancements' : 'Doctrines';
      var h = '<div class="cpan cpan-B cpan-offer"' + stripe(co) + '><div class="cphead">' + colourFlash(co) + '<b>' + esc(co.name) + '</b>' +
        '<span class="ctier">' + C.words(co).tier + ' Tier ' +
        ROMAN[co.tier] + '</span></div>';
      // won, veterancy and trauma, as your own company's row shows them — never what they field
      h += statRow(co, true);
      // the kind of force, then what it is built around: a pill each, what each does in its tip
      h += '<div class="cpdoc carch">' + armyPill(co) + (co.doctrines.length ? co.doctrines.map(function (d) {
        var dd = C.doctrine(d);
        return '<span class="mk" ' + tip(dd.name, dd.text) + '>' + esc(dd.name) + '</span>';
      }).join('') : '<span class="dnote">No ' + esc(creedName) + ' declared yet.</span>') + '</div>';
      // grown since you last met, fighting someone else
      if (o.caught && o.caught.to > o.caught.from) {
        h += '<div class="cpstat">Fighting elsewhere since you last met — Tier ' + ROMAN[o.caught.from] +
          ' to ' + ROMAN[o.caught.to] + '</div>';
      }

      h += jobCard(o, 'A', o.levels);
      h += '<button class="start" data-take-offer="' + i + '">Take this contract</button>';
      return h + '</div>';
    }

    /* The job, as the offer put it and the contract screens show it again: the
       scenario and its world, the Battle Tier and Priority Levels, which side of it
       `side` is on (what that asks of them), and what wins it. `job`: an offer or a
       contract ({ scenario, planet, tier, roles }); `levels`: those it may be fought at. */
    function jobCard(job, side, levels) {
      var sc = root.PMCScen && root.PMCScen.SCENARIOS[job.scenario.id];
      var h = '<div class="offer-job"><div class="offer-scen"><b>' + esc(job.scenario.name) + '</b>' +
        (job.planet && job.planet !== 'random' ? planetPill(job.planet) : '') + '</div>';
      // how big a fight it is: the Battle Tier the D6 gave this job, and the Priority Levels it may be fought at
      levels = levels && levels.length ? levels : [job.pl || 1];
      h += '<div class="offer-size"><span>Battle Tier <b>' + ROMAN[job.tier] + '</b></span>' +
        '<span>Priority Level <b>' + levels.join(' or ') + '</b></span></div>';
      var ro = job.roles;
      if (ro) {
        var mine = ro.attacker === side ? 'attacker' : 'defender';
        h += '<div class="offer-role role-' + mine + '">You ' + (mine === 'attacker' ? 'attack' : 'defend') + '</div>';
        h += '<div class="cpstat">' + esc(sc && sc.roles ? sc.roles[mine] || '' : '') +
          (ro.bestDefence && ro.bestDefence.swapped
            ? ' <b>The Best Defence is Good Offence</b> turned it round (D6 ' + ro.bestDefence.roll + ').' : '') + '</div>';
      } else {
        h += '<div class="cpstat">Neither side has the initiative here \u2014 you meet on even terms.</div>';
      }
      h += '<div class="cpstat">' + esc(sc ? sc.win : '') + '</div>';
      return h + '</div>';
    }

    /* What a unit is carrying, on the button that picks it for a battle: the
       experience it has banked and — the thing that decides whether to give it the
       day off — how close it is to its next Battle Trauma (p. 85). A unit hits a
       Trauma at 10 Trauma Points, 15 with Mental Training, and taking it into
       another fight is what pushes it over. */
    // the Trauma Points a unit carries, and how near it is to its next trauma
    function tpBadge(e) {
      // the picker's own company: Player 2's Mental Training counts on Player 2's screen (HC-12)
      var co = E.camp.companies[seat()] || E.camp.companies.A, wd = C.words(co);
      var cap = C.traumaThreshold(co), tp = e.tp || 0;
      return '<span class="w-tp' + (tp >= cap - 2 ? ' hot' : '') + '" ' + tip('Trauma Points',
        tp + ' of ' + cap + '. A unit that reaches ' + cap + ' rolls on the ' + wd.trauma + ' ' +
        'table and the count starts again.') + '>' + tp + '/' + cap + ' TP</span>';
    }
    function wear(e, noTp) {
      var co = E.camp.companies[seat()] || E.camp.companies.A, wd = C.words(co);
      var cap = C.traumaThreshold(co);
      var tp = e.tp || 0;
      var near = tp >= cap - 2;
      var h = '<span class="wear">';
      if (e.exp) h += '<span class="w-exp">' + e.exp + ' EXP</span>';
      if (!noTp) h += '<span class="w-tp' + (near ? ' hot' : '') + '" ' + tip('Trauma Points',
        tp + ' of ' + cap + '. A unit that reaches ' + cap + ' rolls on the ' + wd.trauma + ' ' +
        'table and the count starts again.') + '>' + tp + '/' + cap + ' TP</span>';
      // each honour and trauma a tag of its own, as the dossier shows them, with its rule on hover
      (e.honours || []).forEach(function (n) {
        var x = C.honourTable(e.key)[n - 1];
        if (x) h += '<span class="mk good" ' + tip(x.name, x.text) + '>' + esc(x.name) + '</span>';
      });
      (e.traumas || []).forEach(function (n) {
        var x = C.traumaTable(e.key)[n - 1];
        if (x) h += '<span class="mk bad" ' + tip(x.name, x.text) + '>' + esc(x.name) + '</span>';
      });
      return h + '</span>';
    }

    function beginContract() {
      // a hotseat contract already being drawn up is taken up again, not rolled afresh (HC-6)
      if (hotseat() && E.contract && !E.camp.pending && E.contract.hot) { E.view = 'contract'; return; }
      var A = E.camp.companies.A;
      /* Whichever force is drawn has been fighting elsewhere, and comes to meet you
         at something like your own standing — give or take a Tier, and never more
         than one above you. */
      var B = E.camp.companies.B;
      var caught = null;
      // an AI force is brought up to strength — never Player 2's company, which is theirs to run (HC-2)
      if (!hotseat() && E.camp.rivals && E.camp.rivals.length) {
        B = E.camp.companies.B;
        var want = C.catchUpTarget(A.tier);
        if (B.tier < want) caught = C.catchUp(B, want);
      }
      var tier = C.rollBattleTier(A, B);
      // a D6 across all six, whatever the Tier — and Foresighted Command's dice (camp-contract.js)
      var fs = C.foresight(A, B, !hotseat());
      var levels = C.levelsFor(A, B, tier.tier);
      E.contract = {
        // the highest Level both can fill in full, not merely field (camp: defaultLevel)
        pl: C.defaultLevel(A, B, tier.tier, levels),
        levels: levels,
        tierRoll: tier, tier: tier.tier, scenario: fs.scenario || fs.fore.dice[0], planet: 'random',
        alt: fs.alt || null, altBy: fs.altBy || (fs.alt ? 'A' : null), fore: fs.fore || null, foreNote: fs.note || null,
        picks: [], terms: {}, caught: caught, hot: hotseat()
      };
      /* At one screen the attacker and defender are settled here, before either player
         picks (HC-7) — The Best Defence is Good Offence asked of whichever of them holds it. */
      var SCr = root.PMCScen;
      if (hotseat() && SCr && SCr.rollRoles && E.contract.scenario && !(fs.fore && !fs.fore.done)) {
        E.contract.roles = SCr.rollRoles(E.contract.scenario.id, { A: A.doctrines || [], B: B.doctrines || [] }, null, ['A', 'B']);
      }
      E.view = 'contract';
    }

    /* The player has picked one of the three. The job was settled when it was
       offered — the enemy, the scenario, the Battle Tier and which side of the
       fight they are on — so nothing is rolled again here. */
    /* A contract with the force picked from the other forces: its job this turn,
       or if it is offering none, one rolled for it now as the offers are and kept
       with them — so backing out and picking it again offers the same Tier, world
       and scenario. */
    function takeRival(r) {
      var offers = C.rollOffers(E.camp), co = (E.camp.rivals || [])[r];
      if (!co) return;
      if (!offers.some(function (o) { return o.rival === r; })) {
        var v = Object.assign({}, E.camp, { rivals: [co], offers: null, offersTurn: null });
        var o = C.rollOffers(v)[0];
        o.rival = r;
        offers.push(o);
        save();
      }
      takeOffer(offers.findIndex(function (o) { return o.rival === r; }));
    }
    function takeOffer(i) {
      var offers = C.rollOffers(E.camp);
      var o = offers[Math.max(0, Math.min(offers.length - 1, i | 0))];
      if (!o) return;
      C.faceRival(E.camp, o.rival);
      // an offer saved before Priority Level was capped at 2 may still carry a 3 or 4
      var lvls = o.levels.filter(function (n) { return n <= 2; });
      E.contract = {
        // the highest Level both can fill in full, not merely field (camp: defaultLevel)
        pl: lvls.length ? C.defaultLevel(E.camp.companies.A, E.camp.companies.B, o.tier, lvls) : 1,
        levels: lvls,
        tierRoll: o.tierRoll, tier: o.tier, scenario: o.scenario, planet: o.planet || 'random',
        roles: o.roles, alt: o.alt || null, altRoles: o.altRoles || null, altBy: o.alt ? 'A' : null,
        fore: o.fore ? JSON.parse(JSON.stringify(o.fore)) : null, foreNote: o.foreNote || null,
        picks: [], terms: {}, caught: o.caught
      };
      save();
      E.view = 'contract';
    }

    /* Which faults are hard. A missing minimum is fixable by adding more units; a
       cap, a budget or a Tier restriction is not, and the unit causing it has to go. */
    function blocking(faults) {
      return (faults || []).filter(function (f) {
        return !/Needs at least/.test(f) && !/No units chosen/.test(f);
      });
    }

    /* Could this company field *any* legal army for this contract? Uses the same greedy
       fill the rules engine uses, restricted to units not away being repaired. */
    function canEverField(co, tier, pl) {
      return C.canFieldArmy(co, tier, pl, true);
    }

    function contractPicks(co, tier, pl) {
      return co.roster.filter(function (e) { return !(e.restUntil > 0); });
    }

    /* Drug Dealer (p. 112): "Before each battle, the player may choose up to 1/3
       of infantry units" — chosen here, with the list. */
    function ordersPanel(co) {
      var rows = [];
      if (C.hasDoctrine(co, 'V4')) {
        var able = drugAble(E.contract.picks), cap = Math.ceil(able.length / 3);    // "up to 1/3" (p. 98), rounded up (p. 27)
        E.contract.drugs = (E.contract.drugs || []).filter(function (id) { return able.some(function (e) { return e.rid === id; }); }).slice(0, cap);
        rows.push('<div class="orow"><b>Drug Dealer</b><em>Up to ' + cap + ' of the infantry go in Determined, and take D6+1 Trauma Points after (' +
          E.contract.drugs.length + ' of ' + cap + ')</em><span class="segs wrap">' +
          (able.length ? able.map(function (e) {
            var on = E.contract.drugs.indexOf(e.rid) >= 0;
            return '<button class="lnk' + (on ? ' on' : '') + '" data-drug="' + e.rid + '"' +
              (!on && E.contract.drugs.length >= cap ? ' disabled' : '') + '>' + esc(e.name) + '</button>';
          }).join('') : '<span class="dnote">No infantry in the list can take them.</span>') + '</span></div>');
      }
      return rows.length ? '<div class="cpan orders">' + rows.join('') + '</div>' : '';
    }
    /* Whose list is being picked. In a hotseat campaign each player picks their
       own force (pp. 84-85): Player 1 first, then the screen is handed over and
       Player 2 picks theirs, on the terms Player 1 has already settled. */
    function seat() { return E.contract && E.contract.side === 'B' ? 'B' : 'A'; }
    function hotseat() { return E.camp && E.camp.mode === 'hotseat'; }
    function contractView() {
      var second = seat() === 'B';
      var A = E.camp.companies[seat()], B = E.camp.companies[second ? 'A' : 'B'];
      var keys = E.contract.picks.map(function (e) { return R.entryPick(e); });
      var chk = R.checkArmy(keys, E.contract.tier, E.contract.pl, A.doctrines, E.contract.tactic || null);
      var roll = E.contract.tierRoll;
      var h = '<h2>Contract</h2>';
      // alone: who it is against, as the online contract says it (the job itself below)
      if (!hotseat()) h += '<p class="lede">' + esc(A.name) + ' against ' + esc(B.name) + ' (an AI force).</p>';
      if (hotseat()) {
        h += '<p class="lede">' + (second ? 'Player 2' : 'Player 1') + ' \u2014 ' + esc(A.name) + '</p>';
        if (second) h += '<div class="cpdoc"><span class="mk">' + esc(B.name) + ' has picked its force: Battle Tier ' +
          ROMAN[E.contract.tier] + ', Priority Level ' + E.contract.pl + '. Pick yours.</span></div>';
      }
      /* Foresighted Command (XEN-11): with both holding it, three dice, and each side
         ignores one in turn before anything else is settled */
      var fore = E.contract.fore;
      if (fore && !fore.done) {
        var who = fore.order[fore.ignored.length], whoCo = E.camp.companies[who];
        h += '<div class="cpan"><div class="cpstat"><b>Foresighted Command</b> \u2014 both forces hold it: three scenario dice, and each ignores one, ' +
          esc(E.camp.companies[fore.order[0]].name) + ' first.</div><div class="cpstat">' + esc(whoCo.name) +
          (hotseat() ? ' (Player ' + (who === 'A' ? 1 : 2) + ')' : '') + ': ignore one.</div>' +
          fore.dice.map(function (d, i) {
            return fore.ignored.indexOf(i) >= 0 ? '<span class="mk">' + d.roll + ' ' + esc(d.name) + ' \u2014 ignored</span> '
              : '<button class="lnk" data-forego="' + i + '">Ignore ' + d.roll + ' \u2014 ' + esc(d.name) + '</button> ';
          }).join('') + '</div>';
        return h;                     // nothing else is settled until the scenario is
      }
      if (fore && fore.done && !second) {
        h += '<div class="cpan"><div class="cpstat">Foresighted Command \u2014 the dice showed ' + fore.dice.map(function (d) { return esc(d.name); }).join(', ') +
          '; with two ignored, it is <b>' + esc(E.contract.scenario.name) + '</b>.</div></div>';
      }
      if (E.contract.foreNote && !second) h += '<div class="cpan"><div class="cpstat">' + esc(E.contract.foreNote) + '</div></div>';
      var altBy = E.contract.altBy || 'A', altMine = altBy === seat();
      if (E.contract.foreBack && !second) h += '<div class="cpdoc"><span class="mk">' + esc(E.contract.foreBack) + '</span></div>';
      if (second && !(E.contract.alt && altBy === 'B')) { /* the terms are settled: the scenario, the Tier and the level */ }
      else if (E.contract.alt && E.contract.alt.id === E.contract.scenario.id) {
        if (!second) h += '<div class="cpan"><div class="cpstat">Foresighted Command — the second scenario die agreed: ' +
          esc(E.contract.alt.name) + ' it is.</div></div>';
      } else if (E.contract.alt && altMine && !E.contract.altUsed) {
        h += '<div class="cpan"><div class="cpstat">Foresighted Command — the second scenario die showed ' +
          E.contract.alt.roll + ', <b>' + esc(E.contract.alt.name) + '</b>. ' + (altBy === 'B' ? 'You' : 'The tribe') + ' may keep either.</div>' +
          '<button class="lnk" data-foresee="1">Fight ' + esc(E.contract.alt.name) + ' instead</button></div>';
      } else if (E.contract.alt && !second && !E.contract.altUsed) {
        h += '<div class="cpan"><div class="cpstat">' + esc(E.camp.companies[altBy].name) + '\u2019s Foresighted Command — a second scenario die showed ' +
          esc(E.contract.alt.name) + '; Player 2 chooses which to fight once you hand over.</div></div>';
      }
      /* The job, rolled with the offer and kept: the scenario, the Battle Tier and
         Level, the world, and which side of it you are on — then the force. */
      if (!hotseat()) h += '<div class="cpan cpan-job">' + jobCard(E.contract, 'A', E.contract.levels) + '</div>';
      /* What is left to decide here stays — The Best Defence is Good Offence's
         roll, when it is waiting to be made. */
      // at one screen, who attacks — settled on the contract, the same for both players (HC-7)
      if (hotseat() && E.contract.roles) {
        var ro = E.contract.roles, SCv = root.PMCScen && root.PMCScen.SCENARIOS[E.contract.scenario.id];
        h += '<div class="cpan"><div class="cpstat"><b>' + esc(E.camp.companies[ro.attacker].name) + '</b> attacks; <b>' +
          esc(E.camp.companies[ro.defender].name) + '</b> defends' +
          (ro.bestDefence && ro.bestDefence.swapped ? ' (The Best Defence is Good Offence turned it round: D6 ' + ro.bestDefence.roll + ')' : '') +
          '.' + (SCv && SCv.roles ? ' <span class="dnote">' + esc(SCv.roles[ro.attacker === seat() ? 'attacker' : 'defender'] || '') + '</span>' : '') + '</div></div>';
      } else if (hotseat() && root.PMCScen && root.PMCScen.SCENARIOS[E.contract.scenario.id] && !root.PMCScen.SCENARIOS[E.contract.scenario.id].attacker) {
        h += '<div class="cpan"><div class="cpstat">Neither side has the initiative here \u2014 you meet on even terms.</div></div>';
      }
      var bd = E.contract.roles && E.contract.roles.bestDefence;
      if (bd && bd.pending && bd.side === seat()) {
        h += '<div class="cpdoc"><button class="lnk" data-go="bestdef">The Best Defence is Good Offence \u2014 roll to attack (2+)</button></div>';
      }
      /* Rebel Tactics (p. 95): chosen once the scenario and who attacks are known,
         before a piece of terrain goes down — so here, with the list. */
      if (A.faction === 'rebel') {
        h += '<div class="cpan orders"><div class="cprom-head"><b>Tactic</b></div><div class="orow">' +
          '<em>' + esc(E.contract.tactic ? R.tacticById(E.contract.tactic).text : 'A rebel force may take one tactic for the battle, or none.') + '</em>' +
          '<span class="segs">' + [{ id: '', name: 'No tactic' }].concat(R.TACTICS).map(function (t) {
            var on = (E.contract.tactic || '') === t.id;
            return '<button class="lnk' + (on ? ' on' : '') + '" data-tactic="' + t.id + '"' +
              (t.text ? ' ' + tip(t.name, t.text) : '') + '>' + esc(t.name) + '</button>';
          }).join('') + '</span></div></div>';
      }
      if (E.contract.caught && E.contract.caught.to > E.contract.caught.from) {
        h += '<div class="cpdoc"><span class="mk">' + esc(E.contract.caught.name) +
          ' has been fighting elsewhere — Tier ' + ROMAN[E.contract.caught.from] + ' to ' +
          ROMAN[E.contract.caught.to] + ' since you last met.</span></div>';
      }

      /* On Our Terms… (p. 87): a player whose company holds it may shift the Battle
         Tier by one — up only as far as both companies can field (the roll's cap).
         When only Player 2 holds it, a shift sends the screen back to Player 1, whose
         force was picked for the old Tier. When both hold it, each says which way:
         both down, it goes down; both up, it goes up; otherwise it stays
         (dossier.js, data-tier). */
      var terms = E.contract.terms || {};
      if (terms.note && !second) h += '<div class="cpdoc"><span class="mk">' + esc(terms.note) + '</span></div>';
      if (terms.noteB && second) h += '<div class="cpdoc"><span class="mk">' + esc(terms.noteB) + '</span></div>';
      if (C.hasDoctrine(A, 'S4') && !E.contract.standard && !terms.done && !(second && terms.B)) {
        var both = C.hasDoctrine(B, 'S4'), vote = !second && both ? (terms.A || 0) : null;
        var btn = function (d, label, off) {
          return '<button class="lnk' + (vote === d ? ' on' : '') + '" data-tier="' + d + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
        };
        h += '<div class="cpdoc"><b>On Our Terms…</b> ' +
          (both ? (second ? esc(B.name) + ' holds it too: say which way. If you both chose the same, the Tier moves (and ' +
                    esc(B.name) + ' picks its force again); if not, it stays at ' + ROMAN[E.contract.tier] + '. '
                  : 'Both companies hold it: say which way. The Tier moves only if Player 2 chooses the same. ')
                : 'lets you shift the Battle Tier by one' + (second ? ' — ' + esc(B.name) + ' will then pick its force again for the new Tier' : '') + '. ') +
          btn(-1, 'Down to ' + ROMAN[Math.max(1, E.contract.tier - 1)], E.contract.tier <= 1) + ' ' +
          (vote !== null ? btn(0, 'Keep ' + ROMAN[E.contract.tier]) + ' ' : '') +
          btn(1, 'Up to ' + ROMAN[Math.min(5, E.contract.tier + 1)], E.contract.tier >= E.contract.tierRoll.cap) +
          (E.contract.tier >= E.contract.tierRoll.cap && E.contract.tier < 5 ? ' <span class="mk">(not both forces can field a higher Tier)</span>' : '') + '</div>';
      }

      /* The standard contract (p. 84): Tier III, Priority Level 2, the Tier not
         rolled at all — when both forces can field it. */
      if (second) { /* nothing to change */ }
      else if (!E.contract.standard && C.canStandard(A, B) && !(E.contract.tier === 3 && E.contract.pl === 2)) {
        h += '<div class="cpdoc"><span class="mk">Both forces can field a Tier III army at Priority Level 2.</span> ' +
          '<button class="lnk" data-go="standard">Take a standard contract instead</button></div>';
      } else if (E.contract.standard) {
        h += '<div class="cpdoc"><span class="mk">Standard contract — Tier III, Priority Level 2.</span></div>';
      }
      // only offer a Priority Level both forces could actually fill
      var lv = E.contract.levels || [1, 2];
      var PLN = { 1: 'skirmish', 2: 'full battle' };
      h += '<div class="field"><div><label for="camp-pl">Priority Level</label>' +
        '<select id="camp-pl"' + (E.contract.standard || second ? ' disabled' : '') + '>' + [1, 2].map(function (n) {
          var can = lv.indexOf(n) >= 0;
          return '<option value="' + n + '"' + (E.contract.pl === n ? ' selected' : '') +
            (can ? '' : ' disabled') + '>' + n + ' — ' + PLN[n] +
            (can ? '' : ' (neither force can fill it)') + '</option>';
        }).join('') + '</select></div></div>';   // the world was rolled with the job, and shown on the offer

      h += '<div class="muster"><div class="muster-head"><b>Take the field</b>' +
        '<span class="pts' + (chk.spent > chk.budget ? ' over' : '') + '">' + chk.spent + ' / ' + chk.budget + '</span></div>';
      /* What each Tier asks for at this Battle Tier and Priority Level, and how
         many of each are in the list — the line the skirmish muster sheet shows. */
      var lims = R.compFor(A.faction || 'pmc', E.contract.tier).limits, cnt = chk.counts || {};
      h += '<p class="limits">' + [1, 2, 3, 4, 5].map(function (t) {
        var lo = lims[t - 1][0] * E.contract.pl, hi = lims[t - 1][1] === 99 ? 99 : lims[t - 1][1] * E.contract.pl;
        if (hi === 0) return null;
        var n = cnt[t] || 0, short = n < lo || n > hi;
        return ROMAN[t] + ' <b' + (short ? ' class="short"' : '') + '>' + n + '/' + (hi === 99 ? lo + '+' : lo + '-' + hi) + '</b>';
      }).filter(Boolean).join(' \u00b7 ') + '</p>';
      h += '<div class="chosen">' + E.contract.picks.map(function (e, i) {
        var p = profile(e.key);
        return '<span class="pickwrap"><button class="pick" data-unpick="' + i + '">' +
          esc(e.name) + ' <b>' + ROMAN[p.tier] + '</b></button></span>';
      }).join('') + '</div>';
      h += '<div class="cat tall">';
      var avail = contractPicks(A).filter(function (e) { return E.contract.picks.indexOf(e) < 0; });
      if (!avail.length) h += '<p class="dnote">Every unit on the books is already in the list.</p>';
      avail.forEach(function (e) {
        var p = profile(e.key);
        var trial = keys.concat([R.entryPick(e)]);
        var bad = blocking(R.checkArmy(trial, E.contract.tier, E.contract.pl, A.doctrines, E.contract.tactic || null).faults);
        h += '<button class="cu" data-pick="' + e.rid + '"' +
          (bad.length ? ' disabled title="' + esc(bad[0]) + '"' : '') + '>' +
          '<span class="t">' + ROMAN[p.tier] + '</span>' +
          '<span><b>' + esc(e.name) + '</b>' + wear(e, true) + '<small>' + esc(p.name) +
          // down the right: the Trauma Points it carries, or what kind of machine it is (machines take none)
          '</small></span><span class="st">' + (p.cls !== 'infantry' ? p.cls : C.isLeaderP(p) ? 'command' : tpBadge(e)) + '</span></button>';
      });
      /* A tribe's turrets and a company's rapid insertion platforms are not bought
         (pp. 86, 140): they are put in the force for the battle, as many as the
         composition allows, and are gone again after it. */
      /* Above the Battle Tier only at Priority Level 2 and up: "On Priority Level 1, you
         cannot use Turrets … of Tiers higher than the Battle Tier" (p. 126; rules review
         a119ac2 XEN-12). The list's own limits decide the rest (checkArmy, below). */
      var fieldable = R.listFor(A.faction || 'pmc').filter(function (p) {
        return (C.isTurretP(p) || p.noSlot) && (p.tier <= E.contract.tier || E.contract.pl > 1);
      });
      if (fieldable.length) {
        h += '<h4>Fielded for this battle</h4>';
        fieldable.forEach(function (p) {
          var bad = blocking(R.checkArmy(keys.concat([p.key]), E.contract.tier, E.contract.pl, A.doctrines, E.contract.tactic || null).faults);
          h += '<button class="cu" data-field="' + p.key + '"' + (bad.length ? ' disabled title="' + esc(bad[0]) + '"' : '') + '>' +
            '<span class="t">' + ROMAN[p.tier] + '</span><span><b>' + esc(p.name) + '</b><small>not bought \u2014 for this battle only</small></span>' +
            '<span class="st">' + p.cls + '</span></button>';
        });
      }
      var resting = A.roster.filter(function (e) { return e.restUntil > 0; });
      if (resting.length) {
        h += '<h4>In the workshop — sitting this one out</h4>';
        resting.forEach(function (e) {
          h += '<button class="cu" disabled><span class="t">' + ROMAN[profile(e.key).tier] + '</span>' +
            '<span><b>' + esc(e.name) + '</b><small>salvaged from the last battle</small></span></button>';
        });
      }
      h += '</div></div>';
      h += ordersPanel(A);
      if (!chk.ok) {
        var why;
        if (blocking(chk.faults).length) {
          why = esc(chk.faults[0]) + ' Drop a unit, or change the list.';
        } else if (!canEverField(A, E.contract.tier, E.contract.pl)) {
          // the company simply does not own the units this contract asks for
          why = esc(chk.faults[0]) + ' ' + esc(A.name) + ' cannot field a legal army at Battle Tier ' +
            ROMAN[E.contract.tier] + ', Priority Level ' + E.contract.pl +
            (E.contract.pl > 1 ? ' — try Priority Level 1.' : ' — recruit or promote first, then come back.');
        } else {
          why = esc(chk.faults[0]) + ' Add more units.';
        }
      }
      /* What still stands in the way is the button's tip, shown on a press while it
         is greyed out (aria-disabled, so the press arrives), not a line of its own. */
      // backing out sits in line with going in, the same button (Player 2 goes back to Player 1's list instead)
      h += '<div class="cacts">' + (second ? '' : '<button class="start cdrop" data-go="cdrop">Turn the contract down</button>') +
        '<button class="start" data-go="fight"' + (chk.ok ? '' : ' aria-disabled="true" data-tip="' + why + '" data-tip-title="Not yet"') +
        '>' + (hotseat() && !second ? 'Hand over to Player 2' : 'Take the field') + '</button></div>';
      h += '<p class="camp-foot">' + (second ? '<button class="lnk" data-go="seatback">Back to ' + esc(B.name) + '\'s list</button>'
        : '<button class="lnk" data-go="hub">Back</button>') + '</p>';
      return h;
    }

    // pick a legal force from the roster, the way the rival does (campaign.js)
    function autoPick(co, tier, pl, tactic) { return C.pickForce(co, tier, pl, tactic); }

    /* Drug Dealer (p. 112): up to a third of the infantry, leaders aside, are sent
       in Determined — and pay for it afterwards. The choice is made as the force
       takes the field, and the marks are cleared again once the aftermath has read
       them. The unit with the most to prove goes first: the ones that have fought
       hardest and carry the least trauma already. */
    // who may be given the drugs: infantry, leaders aside, and up to a third of them
    function drugAble(picks) {
      return picks.filter(function (e) {
        var p = profile(e.key);
        return p.cls === 'infantry' && p.group !== 'First Among Equals' && !p.command;
      });
    }
    /* `chosen`: the player's own pick of rids ("may choose up to 1/3"); without
       one — the rival — the unit with the most to prove goes first. */
    function drugThem(co, picks, chosen) {
      picks.forEach(function (e) { delete e.drugged; });
      if (!C.hasDoctrine(co, 'V4')) return [];
      var able = drugAble(picks);
      var n = Math.ceil(able.length / 3);
      if (n < 1) return [];
      var taken;
      if (chosen) taken = able.filter(function (e) { return chosen.indexOf(e.rid) >= 0; }).slice(0, n);
      else { able.sort(function (a, b) { return a.tp - b.tp; }); taken = able.slice(0, n); }
      taken.forEach(function (e) { e.drugged = true; });
      return taken;
    }

    /* ================= starting the battle ================= */
    /* Player 1's list is down: in a hotseat campaign, the screen goes to
       Player 2 to pick theirs. Returns true when it has handed over. */
    function handOver() {
      E.contract.first = { picks: E.contract.picks, tactic: E.contract.tactic || null, drugs: E.contract.drugs || [] };
      E.contract.side = 'B'; E.contract.picks = []; E.contract.tactic = null; E.contract.drugs = [];
      return true;
    }
    // Player 2 goes back to Player 1's list (and picks again after)
    function seatBack() {
      var f = E.contract && E.contract.first;
      if (!f) return false;
      E.contract.side = 'A'; E.contract.picks = f.picks; E.contract.tactic = f.tactic; E.contract.drugs = f.drugs;
      delete E.contract.first;
      return true;
    }
    function fight() {
      if (hotseat() && seat() === 'A') return handOver();
      var A = E.camp.companies.A, B = E.camp.companies.B;
      var mine = E.contract.first || E.contract, theirTactic, theirs, theirDrugs;
      if (E.contract.first) {
        // hotseat: Player 2 has picked their own force, tactic and drugs
        theirs = E.contract.picks; theirTactic = E.contract.tactic || null; theirDrugs = E.contract.drugs || [];
        if (B.faction !== 'rebel') theirTactic = null;
      } else {
        // a rebel rival picks a tactic of its own, the way a player would (p. 95)
        theirTactic = B.faction === 'rebel' ? [null, 'laststand', 'wave', 'guerillas'][Math.floor(Math.random() * 4)] : null;
        theirs = autoPick(B, E.contract.tier, E.contract.pl, theirTactic);
        if (!R.checkArmy(theirs.map(function (e) { return R.entryPick(e); }),
          E.contract.tier, E.contract.pl, B.doctrines, theirTactic).ok) {
          // the rival cannot field a legal list — let it hire in for this battle
          C.developRival(B);
          theirs = autoPick(B, E.contract.tier, E.contract.pl, theirTactic);
        }
      }
      var picksA = mine.picks, tacticA = mine.tactic || null;
      var druggedA = drugThem(A, picksA, mine.drugs || []);
      var druggedB = drugThem(B, theirs, theirDrugs);
      E.camp.pending = {
        tier: E.contract.tier, pl: E.contract.pl, scenario: E.contract.scenario.id,
        A: picksA.map(function (e) { return e.rid; }),
        B: theirs.map(function (e) { return e.rid; }),
        drugged: picksA.filter(function (e) { return e.drugged; }).map(function (e) { return e.rid; })
          .concat(theirs.filter(function (e) { return e.drugged; }).map(function (e) { return e.rid; }))
      };
      save();
      /* Drug Dealer: who was sent in Determined is said before the battle, and the
         battle waits for it to be read — said and left, the note sat behind the
         battle and came up over the aftermath. */
      var told = druggedA.concat(theirDrugs ? druggedB : []);
      if (told.length) {
        note('Drug Dealer',
          told.map(function (e) { return e.name; }).join(', ') +
          ' go in Determined. They will each take D6+1 extra Trauma Points afterwards.', launch);
      } else launch();
      function launch() {
        close();
        root.PMC_NEWGAME({
          tier: E.contract.tier, pl: E.contract.pl,
          scenario: E.contract.scenario.id,
          // the attacker and defender were settled when the contract was taken
          roles: E.contract.roles || null,
          armyA: picksA.map(function (e) { return R.entryPick(e); }),
          armyB: theirs.map(function (e) { return R.entryPick(e); }),
          nameA: A.name, nameB: B.name,
          colourA: colourOf(A), colourB: colourOf(B),
          dossier: { A: picksA, B: theirs },
          // Modifying the armies (p. 46): what is left on the books, to swap in once the table is laid
          bench: {
            A: A.roster.filter(function (e) { return picksA.indexOf(e) < 0 && !(e.restUntil > 0); }),
            // a rival's spare units are not offered; a second player's are theirs to swap in
            B: theirDrugs ? B.roster.filter(function (e) { return theirs.indexOf(e) < 0 && !(e.restUntil > 0); }) : []
          },
          doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() },
          tactics: { A: A.faction === 'rebel' ? tacticA : null, B: theirTactic },
          campaign: true,
          // which of this browser's campaigns it is for: the result goes to that one
          campLid: root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.lid ? root.PMC_CAMPAIGN.lid() : null,
          mode: E.camp.mode === 'hotseat' ? 'hotseat' : 'ai',
          // two players at one screen swap from their benches in turn, unseen, as a hotseat skirmish does (HC-8)
          secretSwaps: E.camp.mode === 'hotseat',
          planet: E.contract.planet
        });
      }
    }

    return {
      offersView: offersView, beginContract: beginContract, takeOffer: takeOffer, takeRival: takeRival, jobCard: jobCard, contractView: contractView,
      autoPick: autoPick, fight: fight, seatBack: seatBack
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierContract;
})(typeof window !== 'undefined' ? window : global);
