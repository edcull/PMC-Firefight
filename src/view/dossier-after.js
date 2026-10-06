/* PMC 2670 — Firefight : the campaign after a battle: the report, experience and trauma, the honour draw, the rival's dossier, upgrades and doctrines

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierAfter = function (E) {
    var C = E.C, ROMAN = E.ROMAN, coin = E.coin, colourFlash = E.colourFlash, doctrineMarks = E.doctrineMarks, entryCard = E.entryCard,
        esc = E.esc, open = E.open, profile = E.profile, save = E.save;
    /* ================= the aftermath ================= */
    function onFinish(report) {
      if (!E.camp || !E.camp.pending) return;
      report.battleTier = E.camp.pending.tier;
      report.pl = E.camp.pending.pl;
      report.scenario = E.camp.pending.scenario;
      C.clearOffers(E.camp);            // a battle fought: three fresh jobs next turn
      /* The Paths' post-battle choices come first, each at its moment in the book
         (p. 112): Plunderer once the pay is rolled after a win, No Place for the
         Weak! once the Trauma Points are. Kept on the campaign, so a reload on the
         way through picks them up again. */
      var players = E.camp.mode === 'hotseat' ? ['A', 'B'] : ['A'], steps = [];
      players.forEach(function (sd) {
        var co = E.camp.companies[sd];
        if (report.winner === sd && C.hasDoctrine(co, 'V2')) steps.push({ kind: 'plunder', side: sd });
      });
      /* Tough Negotiators (p. 87): after both sides have rolled — and after any
         Plunderer re-roll. Then each player's own questions together, Player 1's
         first (hotseat review HC-13), so the device is passed once between them. */
      players.forEach(function (sd) {
        if (C.hasDoctrine(E.camp.companies[sd], 'S2')) steps.push({ kind: 'negotiate', side: sd });
        if (C.hasDoctrine(E.camp.companies[sd], 'V5')) steps.push({ kind: 'weak', side: sd });
      });
      var askReborn = {}; players.forEach(function (sd) { askReborn[sd] = true; });
      /* Every payment die is rolled now, both sides' at once, before anyone re-rolls
         (p. 85; Tough Negotiators, p. 87: "after both the winner and the loser roll"):
         a player deciding sees both rolls. A rival makes its own re-rolls now. */
      var inc = C.rollIncome(report.battleTier, report.pl, E.camp.companies.A, E.camp.companies.B, report.winner, players);
      E.camp.post = { report: report, pre: { dice: inc.dice, plunder: inc.plunder, neg: inc.neg, tp: {}, weak: {}, askReborn: askReborn }, steps: steps };
      // the aftermath comes up once the battle's result card has been read
      var after = (typeof window !== 'undefined' && window.PMC_AFTER_RESULT) || function (fn) { setTimeout(fn, 900); };
      if (!steps.length) { finishPost(); after(function () { open(E.view); }); return; }
      save();
      E.view = 'post';
      after(function () { open('post'); });
    }
    function finishPost() {
      var post = E.camp.post;
      var opts = {}; for (var k in post.pre) opts[k] = post.pre[k];
      opts.defer = true;                // the other forces' battles are fought out below, not rolled
      E.after = C.aftermath(E.camp, post.report, opts);
      afterTurn('reset');
      // the share of each force lost, from the report (for the figures at the head of the aftermath)
      E.after.loss = {};
      ['A', 'B'].forEach(function (sd) {
        var st = 0, en = 0;
        (post.report.units || []).forEach(function (l) {
          if (l.side !== sd) return;
          st += l.startSize || 0;
          en += l.wiped || l.destroyed ? 0 : Math.min(l.endSize || 0, l.startSize || 0);
        });
        E.after.loss[sd] = st ? Math.round(100 * (st - en) / st) : null;
      });
      /* Kept on the campaign, battle by battle as each is settled, so a reload
         part way through goes on from the next one rather than starting over. */
      if (E.after.pairs && E.after.pairs.length) E.camp.fronts = { pairs: E.after.pairs, done: [], planet: post.report.planet || null };
      if (E.camp.mode === 'solo') {
        E.after.rival = C.developRival(E.camp.companies.B);
        // and the next opponent is drawn now, so the hub can say who is coming
        E.after.next = C.drawRival(E.camp);
      }
      E.camp.post = null;
      E.camp.pending = null;
      if (!E.camp.fronts) keepAfter();
      save();
      E.view = 'aftermath';
    }

    /* ================= elsewhere on the world =================
       While the player counts the cost, the world's other forces fight each
       other two by two, the whole battle played out by the AI on both sides on
       a table nobody sees (engine/offtable.js), one after another. Each is then
       settled like any battle — experience, trauma, losses, pay — and reported
       at the foot of the player's own aftermath as each one ends. */
    var running = null;                 // the pair being fought now, by its place in the list
    function nextFront() {
      var fr = E.camp && E.camp.fronts;
      if (!fr || running != null || fr.done.length >= fr.pairs.length) return;
      var at = fr.done.length, pr = fr.pairs[at], rivals = E.camp.rivals || [];
      var x = rivals[pr[0]], y = pr[1] == null ? null : rivals[pr[1]];
      running = at;
      function settle(rep) {
        running = null;
        if (E.camp.fronts !== fr) return;               // given up on meanwhile
        fr.done.push(x ? C.battleElsewhere(E.camp, x, y, rep || null) : []);
        if (fr.done.length >= fr.pairs.length) frontsDone(); else save();
        if (E.view === 'aftermath' || E.view === 'hub') E.render();
      }
      // the odd one out, if there is one, fights the locals, and that is rolled
      if (!x || !y || !root.PMCOffTable) { setTimeout(function () { settle(null); }, 0); return; }
      root.PMCOffTable.play(x, y, { planet: fr.planet || 'random' }, settle, function (turn) {
        var t = root.document && root.document.getElementById('front-turn');
        if (t) t.textContent = turn ? 'Turn ' + turn : 'Deploying';
      });
    }
    // all fought: the reports go on the aftermath, and the world is free to move on
    function frontsDone() {
      var fr = E.camp.fronts;
      if (E.after && fr) { E.after.elsewhere = [].concat.apply([], fr.done); E.after.fronts = fr.done; }
      E.camp.fronts = null;
      keepAfter();
      save();
    }
    /* The aftermath, once complete, is kept on its battle's line in the log,
       so it can be read again from Battles fought: as it was, with the money
       the force had after it. Only what the page draws is kept. */
    function keepAfter() {
      var last = E.camp.log[E.camp.log.length - 1];
      if (!E.after || !last || last.turn !== E.after.turn) return;
      /* The other fronts' battles once: grouped by front where they were fought
         out (regroup() rebuilds that from the flat list otherwise), not twice. */
      // both sides, and what the AI force did afterwards, for the battle's own card at the head
      var a = E.after, keep = { turn: a.turn, winner: a.winner, payment: a.payment, loss: a.loss || null, sides: { A: a.sides.A, B: a.sides.B || null },
        rival: a.rival || null, fronts: a.fronts || null, elsewhere: a.fronts ? [] : (a.elsewhere || []) };
      last.after = JSON.parse(JSON.stringify(keep));
      last.balance = E.camp.companies.A.kUC;
      if (E.camp.mode === 'hotseat') last.balances = { A: E.camp.companies.A.kUC, B: E.camp.companies.B.kUC };
      // ten kilobytes or so each: the last twenty are kept in full, the rest keep their line
      E.camp.log.slice(0, -20).forEach(function (l) { delete l.after; });
    }
    // a past battle's kept aftermath, opened from Battles fought (by its place in the log), or null
    var past = null;
    function showPast(i) { past = i == null ? null : E.camp.log[i] || null; }
    /* A battle among the other forces, in brief: Tier, Priority Level and
       scenario, then for each side whether it won, what share of its force it
       lost, and what it was paid. */
    function lossPct(b, name) {
      var sd = b && b.sides.filter(function (x) { return x.name === name; })[0];
      if (!sd) return null;
      var st = 0, en = 0;
      sd.units.forEach(function (un) { st += un.start || 0; en += un.lost ? 0 : Math.min(un.end || 0, un.start || 0); });
      return st ? Math.round(100 * (st - en) / st) : null;
    }
    function frontFacts(b) {
      var f = [];
      if (b.tier) f.push('Tier ' + ROMAN[b.tier]);
      if (b.pl) f.push('PL ' + b.pl);
      f.push(C.SCENARIO_NAMES[b.scenario] || b.scenario);
      return f.join(' · ');
    }
    function frontSide(sm, b) {
      var co = (E.camp.rivals || []).filter(function (r) { return r.name === sm.name; })[0];
      var pc = lossPct(b, sm.name);
      return { name: sm.name, result: sm.result === 'won' ? 'Won' : sm.result === 'lost' ? 'Lost' : 'Drew',
        loss: pc == null ? '' : pc + '% losses', pay: '+' + sm.kUC + ' ' + C.money(co),
        gain: '+' + (sm.exp || 0) + ' EXP' + (sm.tp != null ? ' · +' + sm.tp + ' trauma' : ''),
        cells: [
          { cls: 'cs-lost', v: pc == null ? '—' : pc + '%', w: 'losses' },
          { cls: 'cs-win', v: '+' + sm.kUC, w: C.money(co) },
          { cls: 'cs-exp', v: '+' + (sm.exp || 0), w: 'EXP' },
          { cls: 'cs-tra', v: '+' + (sm.tp || 0), w: 'Trauma' }
        ] };
    }
    /* What each force made of it afterwards, in its own words: who it took on,
       who it promoted, the honours it won and the traumas it came away with. */
    function devList(sm) {
      var co = (E.camp.rivals || []).filter(function (r) { return r.name === sm.name; })[0], w = C.words(co);
      var did = sm.did || [], rows = [
        { k: w.recruit === 'Spawn' ? 'Spawned' : 'Recruited', v: did.filter(function (d) { return d.what === 'recruit'; }).map(function (d) { return d.text.replace(/^(recruited|spawned|took delivery of an?) /, ''); }) },
        { k: 'Promotions', v: did.filter(function (d) { return d.what === 'promote' || d.what === 'tier'; }).map(function (d) { return d.text; }) },
        { k: w.honours, v: did.filter(function (d) { return d.what === 'honour'; }).map(function (d) { return d.text.replace(' earned ', ': '); }) },
        { k: w.traumas, v: (sm.traumaList || []).map(function (t) { return t.unit + ': ' + t.name; }) }
      ].filter(function (r) { return r.v.length; });
      if (!rows.length) return '';
      return '<div class="front-dev">' + rows.map(function (r) {
        return '<div><b>' + esc(r.k) + '</b> ' + r.v.map(esc).join(' · ') + '</div>';
      }).join('') + '</div>';
    }
    function frontCard(sums) {
      var b = sums[0] && sums[0].battle;
      if (!b) return '';
      var sides = sums.slice().sort(function (x, y) { return (y.result === 'won') - (x.result === 'won'); });
      var h = '<div class="cpan front"><div class="cprom-head"><b>' + esc(b.sides[0].name) + ' v ' + esc(b.sides[1].name) + '</b></div>' +
        '<p class="cpstat">' + esc(frontFacts(b)) + '</p>';
      sides.forEach(function (sm) {
        var r = frontSide(sm, b);
        // only the winner is marked, or both sides when it was drawn;
        // the side's day in the hub's stat cells, then what it made of it
        h += '<div class="front-row"><b>' + esc(r.name) + '</b>' + (r.result === 'Lost' ? '' : ' <i class="good">' + (r.result === 'Won' ? 'Won' : 'Draw') + '</i>') +
          '<div class="cstats four">' + r.cells.map(function (c) {
            return '<div class="cstat ' + c.cls + '"><b>' + c.v + '</b><span>' + esc(c.w) + '</span></div>';
          }).join('') + '</div>' + devList(sm) + '</div>';
      });
      return h + '</div>';
    }
    /* Who the unit lost, and what the D6 made of each: a 1 killed in action,
       2-6 wounded. Either way they are out of the campaign, and replaced. */
    function casualtyLedger(u) {
      var cas = (u.casualties || []).filter(function (c) { return !c.swarm && c.kia != null; });
      if (!cas.length) return '';
      function who(c) {
        if (c.anon) {
          var Wa = C.fateWords(E.camp.companies[me], 'eshaven');   // the unnamed: killed or wounded, whoever's
          return (c.kia ? c.kia + ' ' + Wa.kia : '') + (c.kia && c.wounded ? ', ' : '') + (c.wounded ? c.wounded + ' ' + Wa.wia : '') +
            (c.rolls ? ' <span class="dmen-rank">D6 ' + c.rolls.join(' ') + '</span>' : '');
        }
        return esc(c.rank) + ' ' + esc(c.name) + (c.roll ? ' <span class="dmen-rank">D6 ' + c.roll + '</span>' : '');
      }
      var W = C.words(E.camp.companies[me]);
      var dead = cas.filter(function (c) { return c.kia; }), hurt = cas.filter(function (c) { return !c.anon && !c.kia; });
      var anon = cas.filter(function (c) { return c.anon; });
      if (anon.length) return '<div class="dledger">Casualties: ' + anon.map(who).join('; ') + '</div>';
      return (dead.length ? '<div class="dledger bad">' + W.kiaLong + ': ' + dead.map(who).join(', ') + '</div>' : '') +
        (hurt.length ? '<div class="dledger">' + W.wiaLong + ': ' + hurt.map(who).join(', ') + '</div>' : '');
    }
    /* The player's own battle, as a card like the ones for the battles elsewhere. */
    function ownCard(last) {
      var you = them(me), coA = E.camp.companies[me];
      var foeName = E.camp.mode === 'hotseat' ? E.camp.companies[you].name : (last && last.against) || (E.camp.companies.B || {}).name || 'the enemy';
      var foe = E.camp.mode === 'hotseat' ? E.camp.companies[you] : (E.camp.rivals || []).filter(function (r) { return r.name === foeName; })[0] ||
        (E.camp.companies.B && E.camp.companies.B.name === foeName ? E.camp.companies.B : null);
      function side(sd, co, name) {
        var rec = E.after.sides[sd] || { units: [], traumas: [] };
        var sum = function (k) { return (rec.units || []).reduce(function (n, u) { return n + (u[k] ? u[k].total : 0); }, 0); };
        var loss = E.after.loss ? E.after.loss[sd] : null;
        return {
          name: name, sd: sd, co: co,
          result: E.after.winner === sd ? 'Won' : E.after.winner ? 'Lost' : 'Drew',
          cells: [
            { cls: 'cs-lost', v: loss == null ? '\u2014' : loss + '%', w: 'losses' },
            { cls: 'cs-win', v: '+' + (E.after.payment[sd] || 0), w: C.money(co) },
            { cls: 'cs-exp', v: '+' + sum('exp'), w: 'EXP' },
            { cls: 'cs-tra', v: '+' + sum('tp'), w: 'Trauma' }
          ],
          // what the AI force did with it afterwards; the player's own choices come on the hub
          dev: sd !== me && E.after.rival ? devList({ name: name, did: E.after.rival,
            traumaList: (rec.traumas || []).map(function (t) { return { unit: t.name, name: t.trauma && t.trauma.name }; }) }) : ''
        };
      }
      var sides = [side(me, coA, coA.name), side(you, foe, foeName)];
      if (E.after.winner === you) sides.reverse();
      var h = '<div class="cpan front"><div class="cprom-head"><b>' + esc(coA.name) + ' v ' + esc(foeName) + '</b></div>' +
        (last ? '<p class="cpstat">' + esc(frontFacts({ tier: last.tier, pl: last.pl, scenario: last.scenario })) + '</p>' : '');
      sides.forEach(function (r) {
        h += '<div class="front-row"><b>' + esc(r.name) + '</b>' + (r.result === 'Lost' ? '' : ' <i class="good">' + (r.result === 'Won' ? 'Won' : 'Draw') + '</i>') +
          '<div class="cstats four">' + r.cells.map(function (c) {
            return '<div class="cstat ' + c.cls + '"><b>' + c.v + '</b><span>' + esc(c.w) + '</span></div>';
          }).join('') + '</div>' + r.dev + '</div>';
      });
      return h + '</div>';
    }
    // the other forces' battles on the aftermath: those fought so far, and the one being fought now
    function frontsSection() {
      var fr = past ? null : E.camp.fronts, done = fr ? fr.done : (E.after.fronts || regroup(E.after.elsewhere || []));
      // online, the server fights them out: how many are still being fought, their reports to follow
      var left = !fr && E.after && E.after.frontsLeft > 0 ? E.after.frontsLeft : 0;
      if (!fr && !done.length && !left) return '';
      var h = '<h3>Elsewhere on the world</h3>';
      if (left) {
        h += '<div class="cpan front running"><p class="cpstat">' + (left === 1 ? 'A battle is' : left + ' battles are') +
          ' still being fought out between the other forces — the reports follow as each one ends.</p><div class="front-bar"><i></i></div></div>';
      }
      if (fr && fr.done.length < fr.pairs.length) {
        nextFront();
        var pr = fr.pairs[fr.done.length], rv = E.camp.rivals || [];
        h += '<div class="cpan front running"><div class="cprom-head"><b>' + esc((rv[pr[0]] || {}).name || '') +
          (pr[1] != null ? ' v ' + esc((rv[pr[1]] || {}).name || '') : '') + '</b></div>' +
          '<p class="cpstat">Fighting — <span id="front-turn">deploying</span></p><div class="front-bar"><i></i></div></div>';
      }
      return h + done.map(frontCard).join('');
    }
    // a flat list of summaries back into battles: the two sides of one come one after the other
    function regroup(ew) {
      var out = [];
      for (var i = 0; i < ew.length; i++) {
        var e1 = ew[i], e2 = ew[i + 1];
        if (e2 && e2.name === e1.vs && e2.vs === e1.name) { out.push([e1, e2]); i++; } else out.push([e1]);
      }
      return out;
    }
    /* The other side's payment roll, beside a player's own while they decide on a
       re-roll: the winner is paid the higher of the two, the loser (and both, in a
       draw) the lower (p. 85). */
    function rollsLine(rep, pre, side, co) {
      var foe = side === 'A' ? 'B' : 'A', fco = E.camp.companies[foe];
      var tot = function (d) { return (d || []).reduce(function (a, b) { return a + b; }, 0); };
      var mine = tot(pre.dice[side]), theirs = tot(pre.dice[foe]);
      if (!pre.dice[foe]) return '';
      var won = rep.winner === side, pay = won ? Math.max(mine, theirs) : Math.min(mine, theirs);
      return '<p class="cpstat">' + esc((fco && fco.name) || 'The other side') + ' rolled <b>' + theirs + '</b>. ' +
        (won ? 'As the winner you are paid the higher roll' : rep.winner === null ? 'In a draw both are paid the lower roll' : 'As the loser you are paid the lower roll') +
        ': <b>' + pay + ' ' + C.money(co) + '</b> as the dice stand.</p>';
    }
    // the post-battle decisions, one to a screen
    function postView() {
      var post = E.camp.post, st = post && post.steps[0];
      if (!st) { finishPost(); return aftermathView(); }
      if (hot() && st.side !== postSeen && !root.PMC_HANDOVER_OFF) return passCard(st.side, 'postpass', 'After the battle');
      var co = E.camp.companies[st.side], rep = post.report, pre = post.pre;
      var h = '<h2>After the battle</h2>';
      if (E.camp.mode === 'hotseat') h += '<p class="lede">' + esc(co.name) + '</p>';
      if (st.kind === 'plunder') {
        if (!pre.dice[st.side]) { pre.dice[st.side] = C.rollPayment(rep.battleTier, rep.pl); save(); }
        var d = pre.dice[st.side], tot = d.reduce(function (a, b) { return a + b; }, 0), pl = pre.plunder[st.side];
        h += '<div class="cpan"><div class="cprom-head"><b>Plunderer</b></div>' +
          '<p class="cpstat">' + esc(co.name) + ' won. Its payment roll: ' + d.length + 'D6.</p>' +
          '<p class="dice-row">' + d.map(function (v) { return '<span class="die">' + v + '</span>'; }).join('') +
          ' <b>= ' + tot + ' ' + C.money(co) + '</b></p>' + rollsLine(rep, pre, st.side, co);
        if (pl && pl.now) {
          h += '<p class="cpstat">Re-rolled from ' + pl.was.reduce(function (a, b) { return a + b; }, 0) + '. The second roll stands.</p>' +
            '<button class="start" data-go="postnext">Continue</button>';
        } else {
          h += '<p class="cpstat">A victorious revolt may go back through the wreckage and re-roll all the dice. The second roll stands, even if it is worse.</p>' +
            '<div class="cprom-row"><button class="start" data-go="plunder">Re-roll all</button>' +
            '<button class="lnk" data-go="postnext">Keep ' + tot + '</button></div>';
        }
        return h + '</div>';
      }
      if (st.kind === 'negotiate') {
        if (!pre.dice[st.side]) { pre.dice[st.side] = C.rollPayment(rep.battleTier, rep.pl); save(); }
        var nd = pre.dice[st.side], ntot = nd.reduce(function (a, b) { return a + b; }, 0), ng = pre.neg[st.side];
        var cap = Math.ceil(nd.length / 2), sel = st.sel || [];
        h += '<div class="cpan"><div class="cprom-head"><b>Tough Negotiators</b></div>' +
          '<p class="cpstat">' + esc(co.name) + '’s payment roll. Up to ' + cap + ' of the dice may be re-rolled; the second result stands, even if it is worse.</p>' +
          rollsLine(rep, pre, st.side, co);
        if (ng) {
          h += '<p class="dice-row">' + nd.map(function (v, i) {
            var sw = ng.idx.indexOf(i) >= 0;
            return '<span class="die' + (sw ? ' re' : '') + '">' + v + '</span>';
          }).join('') + ' <b>= ' + ntot + ' ' + C.money(co) + '</b></p>' +
            '<p class="cpstat">Re-rolled ' + ng.swapped.map(function (w) { return w.was + '→' + w.now; }).join(', ') + '.</p>' +
            '<button class="start" data-go="postnext">Continue</button>';
        } else {
          h += '<p class="dice-row">' + nd.map(function (v, i) {
            var on = sel.indexOf(i) >= 0;
            return '<button class="die pick' + (on ? ' on' : '') + '" data-negdie="' + i + '"' +
              (!on && sel.length >= cap ? ' disabled' : '') + '>' + v + '</button>';
          }).join('') + ' <b>= ' + ntot + ' ' + C.money(co) + '</b></p>' +
            '<div class="cprom-row"><button class="start" data-go="negotiate"' + (sel.length ? '' : ' disabled') + '>Re-roll ' + sel.length + ' of ' + cap + '</button>' +
            '<button class="lnk" data-go="postnext">Keep them all</button></div>';
        }
        return h + '</div>';
      }
      // No Place for the Weak!
      if (!pre.tp[st.side]) {
        /* the salvage dice first: passengers of an aircraft that came down safely
           take the landing's 5 TP, not a casualty's (p. 86) — the same dice the aftermath uses */
        pre.salvage = pre.salvage || {};
        pre.salvage[st.side] = C.salvageRolls(E.camp, rep, st.side, pre.salvage[st.side]);
        pre.tp[st.side] = C.rollTP(E.camp, rep, st.side); save();
      }
      var cand = C.weakCandidates(E.camp, st.side, pre.tp[st.side]);
      if (!cand.length) { post.steps.shift(); save(); return postView(); }
      h += '<div class="cpan"><div class="cprom-head"><b>No Place for the Weak!</b></div>' +
        '<p class="cpstat">' + (cand.length > 1 ? 'These units came back with the most Trauma Points, ' : cand[0].name + ' came back with the most Trauma Points, ') +
        pre.tp[st.side][cand[0].rid].total + '. The revolt may execute ' + (cand.length > 1 ? 'one of them' : 'it') +
        ': it is struck off, and every other unit’s Trauma Points from this battle are halved.</p>' +
        '<div class="segs">' + cand.map(function (e) {
          return '<button class="lnk danger" data-weak="' + e.rid + '">Execute ' + esc(e.name) + '</button>';
        }).join('') + '<button class="lnk" data-weak="">Spare them</button></div></div>';
      return h;
    }

    /* The day's experience and trauma, itemised. The book gives both as a list of
       circumstances (p. 85), so the card shows the list rather than a bare figure:
       what each line was worth, what it came to, and where that leaves the unit. */
    function ledger(kind, led, now, cap) {
      var lines = (led.lines || []).filter(function (l) { return l.n !== 0 || (led.lines || []).length === 1; });
      var isExp = kind === 'exp';
      var sign = led.total > 0 ? '+' : '';
      var h = '<div class="dled ' + (isExp ? 'exp' : 'tp') + (led.total < 0 ? ' good' : '') + '">';
      h += '<div class="dled-head"><b>' + sign + led.total + (isExp ? ' EXP' : ' TP') + '</b>';
      if (now != null) {
        h += '<span class="dled-now">' + (isExp
          ? now + ' banked'
          : now + ' of ' + cap + ' — a Battle Trauma at ' + cap) + '</span>';
      }
      h += '</div>';
      if (lines.length) {
        h += '<ul class="dled-list">' + lines.map(function (l) {
          return '<li><span>' + esc(l.text) + '</span><em>' + (l.n > 0 ? '+' : '') + l.n + '</em></li>';
        }).join('') + '</ul>';
      }
      if (!isExp && cap && now != null && now < cap) {
        h += '<div class="dled-bar"><i style="width:' + Math.min(100, Math.round(100 * now / cap)) + '%"></i></div>';
      }
      return h + '</div>';
    }

    /* Whose aftermath is on screen: Player 1's, then in a hotseat campaign Player 2's,
       each after the device is passed (the same card as the contract's). */
    var me = 'A', afterSide = 'A', afterSeen = null, postSeen = null;
    // two players at one screen (an online campaign is two players, each at their own)
    function hot() { return !!E.camp && E.camp.mode === 'hotseat' && !E.online; }
    // two players' forces, at one screen or online: whose page it is matters
    function two() { return !!E.camp && E.camp.mode === 'hotseat'; }
    function them(sd) { return sd === 'B' ? 'A' : 'B'; }
    function pastBalance(l) {
      var b = l.balances ? l.balances[me] : me === 'A' ? l.balance : null;
      return b != null ? b : '?';
    }
    function passCard(sd, go, title) {
      var co = E.camp.companies[sd];
      return '<h2>' + title + '</h2><button type="button" class="passcard" data-go="' + go + '" data-seat="' + sd + '"' + E.stripeOf(co) + '>' +
        '<small>Pass the device to</small><b>' + esc(co.name) + '</b><span>Player ' + (sd === 'A' ? 1 : 2) + ' \u2014 tap when ready.</span></button>';
    }
    function afterTurn(go, sd) {
      if (go === 'postpass') postSeen = sd;
      else if (go === 'afterpass') afterSeen = afterSide;
      else if (go === 'afternext') afterSide = 'B';
      // a fresh aftermath starts with Player 1, who holds the device already if their questions came last
      else { afterSide = 'A'; afterSeen = postSeen === 'A' ? 'A' : null; postSeen = null; }
    }

    /* A past battle's aftermath is drawn by the same page, from what was kept:
       read only, with the way back to Battles fought at its foot. */
    function aftermathView() {
      if (!past) return afterPage(null);
      var now = E.after;
      E.after = past.after;
      try { return afterPage(past); } finally { E.after = now; }
    }
    function afterPage(pastLine) {
      // online, the page is always this player's own; at one screen, whoever's turn it is
      me = two() ? (pastLine || E.online ? E.hubSide : afterSide) : 'A';
      if (!pastLine && hot() && afterSide !== afterSeen && !root.PMC_HANDOVER_OFF) return passCard(afterSide, 'afterpass', 'Aftermath');
      var co = E.camp.companies[me];
      var h = '<h2>Aftermath' + (pastLine ? ' \u2014 turn ' + pastLine.turn : '') + (two() ? ' \u2014 ' + esc(co.name) : '') + '</h2>';
      /* The day at a glance, drawn as the other forces' battles are: who it was
         against and where, then each side — the winner first — with what it
         lost, was paid and took away in experience and trauma, and what an AI
         force made of it afterwards (who it recruited, who it promoted). */
      var last = pastLine || E.camp.log[E.camp.log.length - 1];
      h += ownCard(last);
      h += '<h3>Payment</h3>';
      var p = E.after.payment;
      var nd = last.tier * last.pl;
      h += '<div class="cpan"><div class="cpstat">Two rolls of ' + nd + 'D6: ' +
        '<span class="dcx">' + p.diceA.join(' ') + '</span> and <span class="dcx">' + p.diceB.join(' ') + '</span>. ' +
        (E.after.winner
          ? 'The winner takes the higher, ' + p.high + '; the loser the lower, ' + p.low + '.'
          : 'A draw, so both companies take the lower, ' + p.low + '.') +
        (p['neg' + me] ? ' Tough Negotiators re-rolled ' + p['neg' + me].swapped.length +
          (p['neg' + me].swapped.length === 1 ? ' die.' : ' dice.') : '') +
        '</div><div class="cphead">' + colourFlash(co) + '<b>' + esc(co.name) + '</b>' +
        '<span class="cmoney">+' + p[me] + ' ' + coin() + ' → ' + (pastLine ? pastBalance(pastLine) : co.kUC) + '</span></div></div>';

      if (p.territory && p.territory[me]) {
        var tt = p.territory[me];
        h += '<div class="cpan"><div class="cpstat">Territorial recalculation (' + (tt.won ? 'the tribe claimed ground' : 'the tribe gave ground') + '): ' +
          '<span class="dcx">' + tt.was.join(' ') + '</span> → <span class="dcx">' + tt.now.join(' ') + '</span> = ' + tt.total + ' TP.</div></div>';
      }
      var rec = E.after.sides[me] || { units: [] };
      if (rec.degenerated && rec.degenerated.length) {
        h += '<div class="cpan"><div class="cpstat">Infamy of Degeneration — ' + rec.degenerated.map(function (d) {
          return esc(d.name) + ' (rolled ' + d.roll + ') lost ' + d.lost + ' EXP';
        }).join('; ') + '.</div></div>';
      }
      // (online, the latest battle's offer stands on its page as read from the log: the server keeps it)
      var offerOpen = !pastLine || (E.online && pastLine === E.camp.log[E.camp.log.length - 1]);
      if (rec.rebornOffer && rec.rebornOffer.length && offerOpen) {
        h += '<div class="cpan"><div class="cprom-head"><b>Enhanced Genetic Memory</b></div>' +
          '<p class="cpstat">A lost infantry unit can be recruited again, now or never: on a D6 of 2-6 the new one remembers everything the old one had before this battle.</p>' +
          rec.rebornOffer.map(function (r, i) {
            if (r.done) return '<div class="orow"><b>' + esc(r.name) + '</b><em>Regrown (D6 ' + r.done.roll + ') — ' +
              (r.done.remembered ? 'it remembers.' : 'the memory did not carry.') + '</em></div>';
            return '<div class="orow"><b>' + esc(r.name) + '</b><span class="segs"><button class="lnk" data-go="reborn" data-i="' + i + '"' +
              (co.kUC < r.cost ? ' disabled' : '') + '>Recruit again — ' + r.cost + ' ' + coin() + '</button></span></div>';
          }).join('') + '</div>';
      }
      if (rec.reborn && rec.reborn.length) {
        h += '<div class="cpan"><div class="cpstat">Enhanced Genetic Memory — ' + rec.reborn.map(function (r) {
          return r.afford ? esc(r.name) + ' is regrown for ' + r.cost + ' TP' + (r.remembered ? ', remembering its experience' : ', its memories lost')
            : esc(r.name) + ' could not be regrown (needs ' + r.cost + ' TP)';
        }).join('; ') + '.</div></div>';
      }
      if (rec.healed && rec.healed.length) {
        h += '<div class="cpan"><div class="cpstat">Supportive Community — ' + rec.healed.map(function (r) {
          return esc(r.name) + ' shakes off ' + esc(r.trauma && r.trauma.name || 'an Infamy');
        }).join('; ') + '.</div></div>';
      }
      // what the swarm fed on (p. 124): Resource Points and new Infected Humans
      if (rec.feeding) h += '<div class="cpan"><div class="cpstat">' + esc(rec.feeding.text) + '</div></div>';
      if (rec.infected && rec.infected.length) {
        h += '<div class="cpan"><div class="cpstat">Fungi Symbiosis — ' + rec.infected.length + ' human unit' +
          (rec.infected.length === 1 ? '' : 's') + ' destroyed in assaults rise again: ' + rec.infected.length +
          ' free unit' + (rec.infected.length === 1 ? '' : 's') + ' of Infected Humans join the swarm.</div></div>';
      }
      h += '<h3>The ' + C.words(co).force + '</h3><div class="dlist">';
      rec.units.forEach(function (u) {
        if (u.rested != null) {
          h += '<div class="dcard rested"><div class="dtop"><b class="dname">' + esc(u.name) + '</b>' +
            '<span class="dtag">sat this one out</span>' +
            (u.workshop ? '<span class="dtag warn">in the workshop</span>' : '') + '</div>';
          h += ledger('tp', u.rested
            ? { total: -u.rested, lines: [{ text: 'Rest and recovery — D3+1 came up ' + u.restRoll, n: -u.rested }] }
            : { total: 0, lines: [{ text: 'Nothing to shake off — D3+1 came up ' + u.restRoll, n: 0 }] },
            u.tpNow, u.tpCap);
          h += '</div>';
          return;
        }
        var tag = u.disbanded ? 'disbanded — ten ' + (co.faction === 'bugs' ? 'flaws' : co.faction === 'xeno' ? 'infamies' : 'traumas')
          : u.aboardDowned && u.wiped ? 'lost with the aircraft'
            : u.wiped ? 'wiped out — struck off' : '';
        h += '<div class="dcard' + (u.wiped ? ' gone' : '') + '"><div class="dtop">' +
          '<b class="dname" title="' + esc(u.name) + '">' + esc(u.name) + '</b>' +
          (tag ? '<span class="dtag bad">' + tag + '</span>' : '') +
          (u.fled && !u.wiped ? '<span class="dtag warn">fled the field</span>' : '') +
          (u.rebuilt ? '<span class="dtag">reconstituted</span>' : '') + '</div>' +
          // what kind it is, under its name, when the name does not say
          (C.isDefaultName(u) ? '' : '<div class="dprof">' + esc(profile(u.key).name) + '</div>');
        /* A unit that is off the dossier has no use for the day's experience or
           trauma, and showing a ledger it can never spend only raises the question
           of why it was struck off in the first place. Say that instead. */
        // who fell, man by man — not for a unit wiped out: it is gone, and that is all the card says
        if (!(u.wiped && !u.disbanded)) h += casualtyLedger(u);
        if (u.wiped && !u.disbanded) {
          // (a machine's own lines, below, say how it was lost and whether it came back)
          if (profile(u.key).cls === 'infantry' || u.aboardDowned) {
            h += '<div class="dledger bad">' + (u.aboardDowned
              ? 'They were aboard when it came down, and it was not recovered — so neither were they.'
              : 'Every soldier was put out of action. Losses in a surviving unit are replaced free, but a unit wiped out to the last model leaves the dossier.') +
              '</div>';
          }
        } else {
          if (u.fled) {
            h += '<div class="dledger">Scattered and ran rather than died: the survivors are back, ' +
              'and their losses are replaced free.</div>';
          }
          if (u.aboardDowned) {
            h += '<div class="dledger">Rode the aircraft down and walked away from the landing.</div>';
          }
          if (u.exp) h += ledger('exp', u.exp, u.expNow, 0);
          if (u.tp) h += ledger('tp', u.tp, u.tpNow, u.tpCap);
        }
        if (u.salvage) {
          h += '<div class="dledger">' + esc(u.salvage.note) +
            (u.salvage.roll ? ' D6 ' + u.salvage.roll + ' → ' + (u.salvage.saved ? 'recovered, and sits out the next battle' : 'lost for good') : '') +
            '</div>';
        }
        if (u.trauma) {
          h += '<div class="dledger bad"><b>' + esc(u.trauma.name) + '</b> ' + esc(u.trauma.text) + '</div>';
        }
        h += '</div>';
      });
      h += '</div>';

      h += frontsSection();

      if (pastLine) {
        // the title bar's Back goes back to the list of battles it was opened from
        return h + '<p class="camp-foot"><button class="lnk" data-go="pastback">Back</button></p>';
      }
      var gaps = C.rebuildNeeds(co);
      if (gaps.length) {
        h += '<div class="cpwarn">The ' + C.words(co).force + ' can no longer field a legal army at Tier ' +
          gaps.map(function (t) { return ROMAN[t]; }).join(', ') +
          '. Recruit or promote from the lowest Tier up before the next contract.</div>';
      }
      // back to the hub, pinned at the foot; not until the other forces' battles are done
      var busy = !!E.camp.fronts;
      /* Hotseat (HC-4, HC-5): Player 1 reads their aftermath, then the device goes
         to Player 2 for theirs — and only then on, to Player 2's own dossier. */
      if (hot() && me === 'A') {
        var nx = E.camp.companies.B;
        return h + '<div class="camp-dock"><button class="start" data-go="afternext">Next: ' + esc(nx.name) + '\u2019s aftermath</button></div>';
      }
      // back to the campaign's hub, on the company (the dossier is a tab away)
      h += '<div class="camp-dock"><button class="start" data-go="afterhub"' + (busy ? ' disabled' : '') + '>' +
        (busy ? 'The other forces are fighting…' : 'Back to the campaign') + '</button></div>';
      return h;
    }

    /* ================= the honour draw ================= */
    /* Battle Honours (p. 88): "The player selects three Battle Honours which the unit
       hasn't gained yet and chooses one of them randomly." Both halves matter — the
       choosing is the player's, the drawing is not — so the three are nominated here
       out of everything the unit could still earn, and then one of them is drawn. */
    function honourView() {
      var picks = E.drawState.picked || [];
      var h = '<h2>' + esc(E.drawState.entry.name) + '</h2>';
      if (!E.drawState.won) {
        h += '<p class="dnote"><b>' + picks.length + ' of 3 chosen \u00b7 ' + E.drawState.cost + ' EXP.</b> ' +
          (picks.length < 3
            ? 'Pick ' + (3 - picks.length) + ' more from the ' + E.drawState.pool.length +
              ' this unit has not earned — tap one again to take it back out.'
            : 'The hat is full. Draw, and the dice decide which of the three it is.') + '</p>';
      }
      h += '<div class="docpick">';
      /* The whole table, so the player sees what the unit has already: those it
         holds, or that its profile rules out, are greyed out and cannot be put forward. */
      var entry = E.drawState.entry;
      var open = {};
      E.drawState.pool.forEach(function (x) { open[x.n] = true; });
      C.honourTable(entry.key).forEach(function (x) {
        var on = picks.indexOf(x.n) >= 0;
        var won = E.drawState.won && E.drawState.won.n === x.n;
        if (E.drawState.won && !on) return;                 // once drawn, show only the three
        var had = entry.honours.indexOf(x.n) >= 0;
        if (!open[x.n]) {
          h += '<button class="doc had" disabled><b>' + esc(x.name) + '</b>' +
            '<i>' + (had ? 'already earned' : 'not for this unit') + '</i><span>' + esc(x.text) + '</span></button>';
          return;
        }
        h += '<button class="doc' + (won ? ' on' : on ? ' picked' : '') + '"' +
          (E.drawState.won || (!on && picks.length >= 3) ? ' disabled' : '') +
          ' data-pickhonour="' + x.n + '">' +
          '<b>' + esc(x.name) + (won ? ' — drawn' : '') + '</b><span>' + esc(x.text) + '</span></button>';
      });
      h += '</div>';
      // the way on stays at the foot of the screen, however long the list above it scrolls
      h += '<div class="honour-foot">';
      if (E.drawState.won) {
        // (the title bar's Back goes back to the dossier)
        h += '<p class="faults ok">' + esc(E.drawState.entry.name) + ' earns <b>' + esc(E.drawState.won.name) + '</b>.</p>';
      } else {
        h += '<button class="start" data-go="drawnow"' + (picks.length === 3 ? '' : ' disabled') + '>' +
          (picks.length === 3 ? 'Draw one of the three' : 'Choose three first') + '</button>';
      }
      h += '<p class="camp-foot"><button class="lnk" data-go="roster">Back</button></p></div>';
      return h;
    }

    /* ================= the rival's dossier ================= */
    function intelView() {
      var rivals = E.camp.rivals || [E.camp.companies.B];
      var co = rivals[Math.min(E.intelIdx, rivals.length - 1)] || E.camp.companies.B;
      var h = '<h2>' + esc(co.name) + '</h2>';
      h += '<p class="lede">' + C.words(co).tier + ' Tier ' + ROMAN[co.tier] +
        ' · ' + co.roster.length + ' units · ' + E.camp.log.filter(function (l) { return l.against === co.name; }).length + ' battles against you.</p>';
      // only the battles fought against this force count toward the record with it
      var mine2 = E.camp.log.filter(function (l) { return !l.against || l.against === co.name; });
      var head = mine2.filter(function (l) { return l.winner === 'A'; }).length;
      var lost = mine2.filter(function (l) { return l.winner === 'B'; }).length;
      h += '<div class="cpan cpan-B"><div class="cpstat">Record between you: ' +
        head + ' to you, ' + lost + ' to them, ' +
        mine2.filter(function (l) { return !l.winner; }).length + ' drawn.</div>' +
        '<div class="cpdoc">' + doctrineMarks(co) + '</div></div>';
      h += '<div class="dlist">';
      co.roster.slice().sort(function (x, y) {
        return profile(y.key).tier - profile(x.key).tier || y.exp - x.exp;
      }).forEach(function (e) { h += entryCard(e, co, {}); });
      h += '</div>';
      h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
      return h;
    }

    /* ================= fitting an upgrade ================= */
    function upgradeView() {
      var h = '<h2>' + esc(E.upState.name) + '</h2>';
      h += '<p class="lede">An Upgrade is chosen, not drawn — 10 EXP, and no more than ' +
        C.upgradeCap(E.upState) + ' on a Tier ' + ROMAN[profile(E.upState.key).tier] + ' machine.</p>';
      h += '<div class="docpick">';
      // the whole table: those already fitted, or meant for the other kind of machine, greyed out
      var openU = {};
      C.availableUpgrades(E.upState).forEach(function (g) { openU[g.n] = true; });
      C.upgradeTable(E.upState.key).forEach(function (g) {
        var kind = g.air ? 'aircraft only' : g.ground ? 'ground vehicles only' : 'any machine';
        if (!openU[g.n]) {
          var fitted = E.upState.upgrades.indexOf(g.n) >= 0;
          h += '<button class="doc had" disabled><b>' + esc(g.name) + '</b>' +
            '<i>' + (fitted ? 'already fitted' : kind) + '</i><span>' + esc(g.text) + '</span></button>';
          return;
        }
        h += '<button class="doc" data-fit="' + g.n + '"><b>' + esc(g.name) + '</b>' +
          '<i>' + kind + '</i>' +
          '<span>' + esc(g.text) + '</span></button>';
      });
      h += '</div><p class="camp-foot"><button class="lnk" data-go="roster">Back</button></p>';
      return h;
    }

    /* ================= doctrine picking ================= */
    function doctrineView() {
      var co = E.camp.companies[E.docSide];
      var cr = C.creedOf(co), reb = co.faction === 'rebel', bug = co.faction === 'bugs' || co.faction === 'xeno';
      var open = C.doctrineSlots(co) - co.doctrines.length;
      if (E.docSwap && C.canSwapDoctrine(co).ok) return swapView(co, cr);
      var h = '<h2>Choose ' + (co.faction === 'bugs' ? 'an ' : 'a ') + cr.one + '</h2>';
      h += '<p class="lede">' + esc(co.name) + ' has ' + open + ' ' + cr.one +
        ' slot' + (open === 1 ? '' : 's') + ' free — one per ' + C.words(co).tier +
        ' Tier, and no more than two ' + (reb || bug ? 'from any one group.' : 'from a category.') + '</p>';
      // the command grade the force has just left, there to be recruited again (at its price) for the smaller fights
      var oldCmd = co.tier > 1 ? C.commandKey(co, co.tier - 1) : null;
      if (oldCmd && !co.roster.some(function (e) { return e.key === oldCmd; })) {
        var w = C.words(co);
        h += '<p class="cpstat cmdhint">Your old ' + esc(w.cmd) + ', ' + esc(profile(oldCmd).name) + ', can be ' + esc(w.recruited) +
          ' again as a second one for ' + C.recruitCost(co, oldCmd) + ' ' + esc(C.money(co)) + ' \u2014 ' +
          (co.faction === 'bugs' ? 'a swarm fields a Leader Bug of the Battle Tier or higher, and without one this low it cannot field the smaller fights.'
            : 'the new one is too senior for the smaller fights.') + '</p>';
      }
      cr.cats.forEach(function (cat) {
        var held = co.doctrines.filter(function (x) {
          return cr.by[x] && cr.by[x].cat === cat;
        }).length;
        h += '<h3>' + (reb ? 'Paths of the ' + cat : co.faction === 'xeno' ? cat + ' Advancements' : bug ? cat + ' Pathways' : cat) + ' <span class="dtag">' + held + ' of 2</span></h3>';
        h += '<div class="docpick">';
        cr.list.filter(function (d) { return d.cat === cat; }).forEach(function (d) {
          var chk = C.canTakeDoctrine(co, d.id);
          var have = C.hasDoctrine(co, d.id);
          h += '<button class="doc' + (have ? ' on' : '') + '" data-take="' + d.id + '"' +
            (chk.ok ? '' : ' disabled title="' + esc(have ? 'Already held.' : chk.why) + '"') + '>' +
            '<b>' + esc(d.name) + '</b><i>' + (d.where === 'battle' ? 'on the table' :
              d.where === 'list' ? 'army list' : d.where === 'payment' ? 'payday' :
                d.where === 'contract' ? 'before the battle' : d.where ? 'aftermath' : '&nbsp;') + '</i>' +
            '<span>' + esc(d.text) + '</span></button>';
        });
        h += '</div>';
      });
      h += '<p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
      return h;
    }

    /* A Tier V change: first the one to give up, then the one to take in its place. */
    function swapView(co, cr) {
      var h = '<h2>Change a ' + cr.one + '</h2>';
      h += '<p class="lede">' + esc(co.name) + ' may change one ' + cr.one + ' now, and again five battles later. ' +
        (E.swapOut ? 'Giving up <b>' + esc(C.doctrine(E.swapOut).name) + '</b> — pick what replaces it.' : 'Pick the one to give up.') + '</p>';
      h += '<div class="docpick">';
      if (!E.swapOut) {
        co.doctrines.forEach(function (id) {
          var d = C.doctrine(id);
          h += '<button class="doc on" data-swapout="' + id + '"><b>' + esc(d.name) + '</b><span>' + esc(d.text) + '</span></button>';
        });
      } else {
        var trial = { doctrines: co.doctrines.filter(function (x) { return x !== E.swapOut; }), tier: co.tier, faction: co.faction };
        cr.list.forEach(function (d) {
          if (d.id === E.swapOut) return;
          var chk = C.canTakeDoctrine(trial, d.id);
          if (!chk.ok && C.hasDoctrine(co, d.id)) return;
          h += '<button class="doc" data-swapin="' + d.id + '"' + (chk.ok ? '' : ' disabled title="' + esc(chk.why) + '"') +
            '><b>' + esc(d.name) + '</b><i>' + esc(d.cat) + '</i><span>' + esc(d.text) + '</span></button>';
        });
      }
      h += '</div><p class="camp-foot"><button class="lnk" data-go="hub">Back</button></p>';
      return h;
    }

    return {
      onFinish: onFinish, postView: postView, aftermathView: aftermathView, nextFront: nextFront, showPast: showPast, honourView: honourView,
      intelView: intelView, upgradeView: upgradeView, doctrineView: doctrineView,
      afterTurn: afterTurn, get afterSide() { return hot() ? afterSide : 'A'; }
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierAfter;
})(typeof window !== 'undefined' ? window : global);
