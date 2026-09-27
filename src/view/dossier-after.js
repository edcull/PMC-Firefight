/* PMC 2670 — Firefight : the campaign after a battle: the report, experience and trauma, the honour draw, the rival's dossier, upgrades and doctrines

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierAfter = function (E) {
    var C = E.C, ROMAN = E.ROMAN, coin = E.coin, colourFlash = E.colourFlash, entryCard = E.entryCard,
        esc = E.esc, open = E.open, profile = E.profile, save = E.save, tip = E.tip;
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
      // Tough Negotiators (p. 87): after both sides have rolled — and after any Plunderer re-roll
      players.forEach(function (sd) {
        if (C.hasDoctrine(E.camp.companies[sd], 'S2')) steps.push({ kind: 'negotiate', side: sd });
      });
      players.forEach(function (sd) {
        if (C.hasDoctrine(E.camp.companies[sd], 'V5')) steps.push({ kind: 'weak', side: sd });
      });
      var askReborn = {}; players.forEach(function (sd) { askReborn[sd] = true; });
      E.camp.post = { report: report, pre: { dice: {}, plunder: {}, neg: {}, tp: {}, weak: {}, askReborn: askReborn }, steps: steps };
      if (!steps.length) { finishPost(); setTimeout(function () { open(E.view); }, 900); return; }
      save();
      E.view = 'post';
      setTimeout(function () { open('post'); }, 900);
    }
    function finishPost() {
      var post = E.camp.post;
      var opts = {}; for (var k in post.pre) opts[k] = post.pre[k];
      opts.defer = true;                // the other forces' battles are fought out below, not rolled
      E.after = C.aftermath(E.camp, post.report, opts);
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
      var a = E.after, keep = { turn: a.turn, winner: a.winner, payment: a.payment, sides: { A: a.sides.A }, fronts: a.fronts || null, elsewhere: a.elsewhere || [] };
      if (E.camp.mode === 'hotseat' && a.sides.B) keep.sides.B = a.sides.B;
      last.after = JSON.parse(JSON.stringify(keep));
      last.balance = E.camp.companies.A.kUC;
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
    // the other forces' battles on the aftermath: those fought so far, and the one being fought now
    function frontsSection() {
      var fr = past ? null : E.camp.fronts, done = fr ? fr.done : (E.after.fronts || regroup(E.after.elsewhere || []));
      if (!fr && !done.length) return '';
      var h = '<h3>Elsewhere on the world</h3>';
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
    // the post-battle decisions, one to a screen
    function postView() {
      var post = E.camp.post, st = post && post.steps[0];
      if (!st) { finishPost(); return aftermathView(); }
      var co = E.camp.companies[st.side], rep = post.report, pre = post.pre;
      var h = '<h2>After the battle</h2>';
      if (E.camp.mode === 'hotseat') h += '<p class="lede">' + esc(co.name) + '</p>';
      if (st.kind === 'plunder') {
        if (!pre.dice[st.side]) { pre.dice[st.side] = C.rollPayment(rep.battleTier, rep.pl); save(); }
        var d = pre.dice[st.side], tot = d.reduce(function (a, b) { return a + b; }, 0), pl = pre.plunder[st.side];
        h += '<div class="cpan"><div class="cprom-head"><b>Plunderer</b></div>' +
          '<p class="cpstat">' + esc(co.name) + ' won. Its payment roll: ' + d.length + 'D6.</p>' +
          '<p class="dice-row">' + d.map(function (v) { return '<span class="die">' + v + '</span>'; }).join('') +
          ' <b>= ' + tot + ' ' + C.money(co) + '</b></p>';
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
          '<p class="cpstat">' + esc(co.name) + '’s payment roll. Up to ' + cap + ' of the dice may be re-rolled; the second result stands, even if it is worse.</p>';
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
      if (!pre.tp[st.side]) { pre.tp[st.side] = C.rollTP(E.camp, rep, st.side); save(); }
      var cand = C.weakCandidates(E.camp, st.side, pre.tp[st.side]);
      if (!cand.length) { post.steps.shift(); save(); return postView(); }
      h += '<div class="cpan"><div class="cprom-head"><b>No Place for the Weak!</b></div>' +
        '<p class="cpstat">' + (cand.length > 1 ? 'These units came back with the most Trauma Points, ' : cand[0].name + ' came back with the most Trauma Points, ') +
        pre.tp[st.side][cand[0].rid].total + '. The revolt may execute ' + (cand.length > 1 ? 'one of them' : 'it') +
        ': it is struck off, and every other unit’s Trauma Points from this battle are halved.</p>' +
        '<div class="segs">' + cand.map(function (e) {
          return '<button class="lnk warn" data-weak="' + e.rid + '">Execute ' + esc(e.name) + '</button>';
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

    /* A past battle's aftermath is drawn by the same page, from what was kept:
       read only, with the way back to Battles fought at its foot. */
    function aftermathView() {
      if (!past) return afterPage(null);
      var now = E.after;
      E.after = past.after;
      try { return afterPage(past); } finally { E.after = now; }
    }
    function afterPage(pastLine) {
      var h = '<h2>Aftermath' + (pastLine ? ' \u2014 turn ' + pastLine.turn : '') + '</h2>';
      var res = E.after.winner === 'A' ? 'A victory.' : E.after.winner === 'B' ? 'A defeat.' : 'A draw.';
      h += '<p class="lede">Campaign turn ' + E.after.turn + '. ' + res + '</p>';

      h += '<h3>Payment</h3>';
      var p = E.after.payment;
      var last = pastLine || E.camp.log[E.camp.log.length - 1];
      var nd = last.tier * last.pl;
      h += '<div class="cpan"><div class="cpstat">Two rolls of ' + nd + 'D6: ' +
        '<span class="dcx">' + p.diceA.join(' ') + '</span> and <span class="dcx">' + p.diceB.join(' ') + '</span>. ' +
        (E.after.winner
          ? 'The winner takes the higher, ' + p.high + '; the loser the lower, ' + p.low + '.'
          : 'A draw, so both companies take the lower, ' + p.low + '.') +
        (p.negA ? ' Tough Negotiators re-rolled ' + p.negA.swapped.length +
          (p.negA.swapped.length === 1 ? ' die.' : ' dice.') : '') +
        '</div><div class="cphead">' + colourFlash(E.camp.companies.A) + '<b>' + esc(E.camp.companies.A.name) + '</b>' +
        '<span class="cmoney">+' + p.A + ' ' + coin() + ' → ' + (pastLine ? (pastLine.balance != null ? pastLine.balance : '?') : E.camp.companies.A.kUC) + '</span></div></div>';

      if (p.territory && p.territory.A) {
        var tt = p.territory.A;
        h += '<div class="cpan"><div class="cpstat">Territorial recalculation (' + (tt.won ? 'the tribe claimed ground' : 'the tribe gave ground') + '): ' +
          '<span class="dcx">' + tt.was.join(' ') + '</span> → <span class="dcx">' + tt.now.join(' ') + '</span> = ' + tt.total + ' TP.</div></div>';
      }
      var rec = E.after.sides.A;
      if (rec.degenerated && rec.degenerated.length) {
        h += '<div class="cpan"><div class="cpstat">Infamy of Degeneration — ' + rec.degenerated.map(function (d) {
          return esc(d.name) + ' (rolled ' + d.roll + ') lost ' + d.lost + ' EXP';
        }).join('; ') + '.</div></div>';
      }
      if (rec.rebornOffer && rec.rebornOffer.length && !pastLine) {
        h += '<div class="cpan"><div class="cprom-head"><b>Enhanced Genetic Memory</b></div>' +
          '<p class="cpstat">A lost infantry unit can be recruited again, now or never: on a D6 of 2-6 the new one remembers everything the old one had before this battle.</p>' +
          rec.rebornOffer.map(function (r, i) {
            if (r.done) return '<div class="orow"><b>' + esc(r.name) + '</b><em>Regrown (D6 ' + r.done.roll + ') — ' +
              (r.done.remembered ? 'it remembers.' : 'the memory did not carry.') + '</em></div>';
            return '<div class="orow"><b>' + esc(r.name) + '</b><span class="segs"><button class="lnk" data-go="reborn" data-i="' + i + '"' +
              (E.camp.companies.A.kUC < r.cost ? ' disabled' : '') + '>Recruit again — ' + r.cost + ' ' + coin() + '</button></span></div>';
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
      h += '<h3>The ' + C.words(E.camp.companies.A).force + '</h3><div class="dlist">';
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
        var tag = u.disbanded ? 'disbanded — ten ' + (E.camp.companies.A.faction === 'bugs' ? 'flaws' : E.camp.companies.A.faction === 'xeno' ? 'infamies' : 'traumas')
          : u.aboardDowned && u.wiped ? 'lost with the aircraft'
            : u.wiped ? 'wiped out — struck off' : '';
        h += '<div class="dcard' + (u.wiped ? ' gone' : '') + '"><div class="dtop">' +
          '<b class="dname">' + esc(u.name) + '</b>' +
          (u.name === profile(u.key).name ? '' : '<span class="dprof">' + esc(profile(u.key).name) + '</span>') +
          (tag ? '<span class="dtag bad">' + tag + '</span>' : '') +
          (u.fled && !u.wiped ? '<span class="dtag warn">fled the field</span>' : '') +
          (u.rebuilt ? '<span class="dtag">reconstituted</span>' : '') + '</div>';
        /* A unit that is off the dossier has no use for the day's experience or
           trauma, and showing a ledger it can never spend only raises the question
           of why it was struck off in the first place. Say that instead. */
        if (u.wiped && !u.disbanded) {
          h += '<div class="dledger bad">' + (u.aboardDowned
            ? 'They were aboard when it came down, and it was not recovered — so neither were they.'
            : 'Every soldier was killed. Losses in a surviving unit are replaced free, but a unit wiped out to the last model leaves the dossier.') +
            '</div>';
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
        return h + '<div class="camp-dock"><button class="start" data-go="pastback">Back to the battles</button></div>' +
          '<p class="camp-foot"><button class="lnk" data-go="hub">The campaign</button></p>';
      }
      var gaps = C.rebuildNeeds(E.camp.companies.A);
      if (gaps.length) {
        h += '<div class="cpwarn">The ' + C.words(E.camp.companies.A).force + ' can no longer field a legal army at Tier ' +
          gaps.map(function (t) { return ROMAN[t]; }).join(', ') +
          '. Recruit or promote from the lowest Tier up before the next contract.</div>';
      }
      // on to the dossier, pinned at the foot; not until the other forces' battles are done
      var busy = !!E.camp.fronts;
      h += '<div class="camp-dock"><button class="start" data-go="roster"' + (busy ? ' disabled' : '') + '>' +
        (busy ? 'The other forces are fighting…' : 'Dossier') + '</button></div>';
      h += '<p class="camp-foot"><button class="lnk" data-go="hub">The campaign</button></p>';
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
      var hw = C.words(E.camp.companies.A).honours;
      h += '<p class="lede">Put three ' + hw + ' forward, then one of the three is taken at ' +
        'random (p. ' + (hw === 'Adaptations' ? 125 : 88) + '). ' + E.drawState.cost + ' EXP.</p>';
      if (!E.drawState.won) {
        h += '<p class="dnote"><b>' + picks.length + ' of 3 chosen.</b> ' +
          (picks.length < 3
            ? 'Pick ' + (3 - picks.length) + ' more from the ' + E.drawState.pool.length +
              ' this unit has not earned — tap one again to take it back out.'
            : 'The hat is full. Draw, and the dice decide which of the three it is.') + '</p>';
      }
      h += '<div class="docpick">';
      E.drawState.pool.forEach(function (x) {
        var on = picks.indexOf(x.n) >= 0;
        var won = E.drawState.won && E.drawState.won.n === x.n;
        if (E.drawState.won && !on) return;                 // once drawn, show only the three
        h += '<button class="doc' + (won ? ' on' : on ? ' picked' : '') + '"' +
          (E.drawState.won || (!on && picks.length >= 3) ? ' disabled' : '') +
          ' data-pickhonour="' + x.n + '">' +
          '<b>' + esc(x.name) + (won ? ' — drawn' : '') + '</b><span>' + esc(x.text) + '</span></button>';
      });
      h += '</div>';
      if (E.drawState.won) {
        h += '<p class="faults ok">' + esc(E.drawState.entry.name) + ' earns <b>' + esc(E.drawState.won.name) + '</b>.</p>';
        h += '<button class="start" data-go="roster">Back to the dossier</button>';
      } else {
        h += '<button class="start" data-go="drawnow"' + (picks.length === 3 ? '' : ' disabled') + '>' +
          (picks.length === 3 ? 'Draw one of the three' : 'Choose three first') + '</button>';
      }
      h += '<p class="camp-foot"><button class="lnk" data-go="roster">Back</button></p>';
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
        '<div class="cpdoc">' + co.doctrines.map(function (d) {
          return '<span class="mk" ' + tip(C.doctrine(d).name, C.doctrine(d).text) + '>' + esc(C.doctrine(d).name) + '</span>';
        }).join('') + '</div></div>';
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
      C.availableUpgrades(E.upState).forEach(function (g) {
        h += '<button class="doc" data-fit="' + g.n + '"><b>' + esc(g.name) + '</b>' +
          '<i>' + (g.air ? 'aircraft only' : g.ground ? 'ground vehicles only' : 'any machine') + '</i>' +
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
      intelView: intelView, upgradeView: upgradeView, doctrineView: doctrineView
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierAfter;
})(typeof window !== 'undefined' ? window : global);
