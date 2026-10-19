/* PMC 2670 — Firefight : a battle's statistics, read off its log
   What each side did and what came of it, counted from the battle log: the
   decisions of a side the computer runs, the moves, the shots (stationary, at
   half range, pinned, what each needed on the D10 and what it hit), the charges
   (forced by Death or Glory, stopped by defensive fire, won, lost), what it
   inflicted, and what it lost and when. The engine keeps them on its battle report
   (endphase.js), a campaign on each battle's line of its log (camp-aftermath.js),
   and the balance scripts read them to compare the AI's play with a player's or
   with another AI's (scripts/balance/aistats.js). A player's own decisions are not
   logged as the computer's are: for that side `activations` and `decide` stay 0. */
(function (root) {
  'use strict';

  // a blank tally for one side of one battle
  function tally() {
    return {
      battles: 0, wins: 0, draws: 0, turns: 0,
      decide: {}, holds: 0, holdNoShot: 0,
      moves: 0, inches: 0,
      need: {}, needMove: {},
      shots: 0, shotsStill: 0, shotsHalf: 0, shotsAux: 0, hits: 0, zeroHit: 0, shotDist: 0,
      sp: 0, men: 0, machineDmg: 0,
      charges: 0, chargeWon: 0, chargeLost: 0, chargeStopped: 0, chargeDog: 0,
      regroups: 0, rallied: 0,
      suppressedTaken: 0, brokenTaken: 0, unitsLost: 0, lostByTurn: {},
      activations: 0
    };
  }
  function sideOf(text) { var m = /\[(A|B)\]/.exec(text || ''); return m ? m[1] : null; }
  function bump(o, k, n) { o[k] = (o[k] || 0) + (n == null ? 1 : n); }

  // a battle's log read into the two sides' tallies: { A: tally, B: tally }
  function read(log) {
    var T = { A: tally(), B: tally() };
    var turn = 0, inRally = false, lastAttack = null, pendingHold = null, charge = null;
    function settleHold() { if (pendingHold) { T[pendingHold].holdNoShot++; pendingHold = null; } }
    (log || []).forEach(function (l) {
      var text = l.text || '', s = sideOf(text), m;
      if (l.t === 'turn') { m = /^Turn (\d+)/.exec(text); if (m) turn = +m[1]; inRally = false; settleHold(); return; }
      if (l.t === 'phase' && /Rally phase/.test(text)) { inRally = true; settleHold(); return; }
      if (l.t === 'ai') {
        var d = / — chooses: .*: (\w+)\.$/.exec(text) || / — behaviour D6 .* = -?\d+: (\w+)\.$/.exec(text);
        if (d && s) { settleHold(); bump(T[s].decide, d[1]); T[s].activations++; }
        if (/ holds its position| holds the building| keeps its head down/.test(text) && s) { T[s].holds++; pendingHold = s; }
        return;
      }
      if (l.t === 'move' && s) {
        m = / moves ([\d.]+)"/.exec(text);
        if (m) { T[s].moves++; T[s].inches += +m[1]; }
        return;
      }
      if (l.t === 'shoot' && s) {
        if (pendingHold === s) pendingHold = null;           // it held, and shot from where it stood
        var st = T[s], math = String(l.math || '');
        st.shots++;
        if (/stationary/.test(math)) st.shotsStill++;
        if (/half range/.test(math)) st.shotsHalf++;
        if (/auxiliary/.test(text)) st.shotsAux++;
        var h = /→ (\d+) hit/.exec(math), dist = / at ([\d.]+)"/.exec(text);
        // what the shot needed on the D10 to hit at all (Defence less its modifiers): 1 or less is sure, 10 only a 9 does it
        var mr = /D10 rolls (\d+).*= (-?\d+) vs Defence (\d+)/.exec(math);
        if (mr) {
          var need = Math.max(0, Math.min(10, +mr[3] - (+mr[2] - +mr[1]) + 1));
          bump(st.need, need);
          if (!/stationary/.test(math)) bump(st.needMove, need);
        }
        if (h) { st.hits += +h[1]; if (+h[1] === 0) st.zeroHit++; }
        if (dist) st.shotDist += +dist[1];
        lastAttack = s;
        return;
      }
      if (l.t === 'assault' && / charges /.test(text) && s) {
        T[s].charges++; lastAttack = s;
        m = /^(.*) charges (.*) — /.exec(text);
        charge = m ? { side: s, atk: m[1], def: m[2] } : null;
        return;
      }
      if (l.t === 'hits' && lastAttack) {
        var at = T[lastAttack];
        (text.match(/\((\d+) SP\)/g) || []).forEach(function (x) { at.sp += +/\d+/.exec(x)[0]; });
        (text.match(/Man down! \((\d+) model/g) || []).forEach(function (x) { at.men += +/\d+/.exec(x)[0]; });
        (text.match(/\((?:D3 )?(\d+) DP\)/g) || []).forEach(function (x) { at.machineDmg += +/(\d+) DP/.exec(x)[1]; });
        return;
      }
      if (charge && l.t === 'rally' && /Death or Glory/.test(text)) T[charge.side].chargeDog++;
      if ((l.t === 'note' || l.t === 'kill' || l.t === 'broken') && charge) {
        // the charge's end: stopped by defensive fire; the defender broken, out or driven back (a win); the attacker so (a loss)
        if (/Defensive fire stops the charge/.test(text)) { T[charge.side].chargeStopped++; charge = null; }
        else if (text.indexOf(charge.def) === 0 && /breaks|wiped out|BROKEN|falls back|gives ground|cannot give ground/.test(text)) { T[charge.side].chargeWon++; charge = null; }
        else if (text.indexOf(charge.atk) === 0 && /breaks|wiped out|BROKEN|falls back/.test(text)) { T[charge.side].chargeLost++; charge = null; }
        else if (/^Neither side breaks/.test(text)) charge = null;
      }
      if (l.t === 'suppressed' && s) T[s].suppressedTaken++;
      if (l.t === 'broken' && s) T[s].brokenTaken++;
      if (l.t === 'kill' && s) { T[s].unitsLost++; bump(T[s].lostByTurn, turn); }
      if (l.t === 'rally' && s) {
        m = /removes (\d+) SP/.exec(text);
        if (m) T[s].rallied += +m[1];
        // (outside the Rally phase, a unit's own Pass/Regroup action)
        if (!inRally && / rallies:|regroup/i.test(text)) T[s].regroups++;
      }
    });
    settleHold();
    return T;
  }

  /* A finished battle's statistics as its report carries them: each side's tally,
     with the battle's own outcome folded in (one battle, its turns, won or drawn)
     and whether the computer ran that side. */
  function ofBattle(log, opts) {
    var T = read(log), o = opts || {};
    ['A', 'B'].forEach(function (s) {
      var t = T[s];
      t.battles = 1; t.turns = o.turns || 0;
      t.wins = o.winner === s ? 1 : 0; t.draws = o.winner ? 0 : 1;
      t.ai = !!(o.ai && o.ai[s]);
    });
    return T;
  }

  // tallies added together (a run of battles, one side's)
  function add(a, b) {
    var out = a || tally();
    Object.keys(b || {}).forEach(function (k) {
      if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k];
      else if (b[k] && typeof b[k] === 'object') { out[k] = out[k] || {}; Object.keys(b[k]).forEach(function (g) { bump(out[k], g, b[k][g]); }); }
    });
    return out;
  }

  root.PMCBattleStats = { tally: tally, read: read, ofBattle: ofBattle, add: add };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCBattleStats;
})(typeof window !== 'undefined' ? window : global);
