/* PMC 2670 — Firefight : modifying the armies before the battle: what may be swapped for what

   Made once by engine.js, the first time it is wanted. E is what it needs
   of engine.js: what never changes bound here once, and
   what does (the battle itself, and anything else reassigned) read through
   E as it is now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCEngineSwaps = function (E) {
    var R = E.R, byId = E.byId, docsOf = E.docsOf, isAI = E.isAI, logLine = E.logLine,
        lookAtDeployment = E.lookAtDeployment, makeUnit = E.makeUnit, pushRes = E.pushRes, render = E.render,
        sideName = E.sideName;

    /* ---- Modifying the armies (p. 46): up to a quarter of a player's units — half
       with Tactical Flexibility (p. 87) — swapped for others of the same Unit
       Tier: from the dossier in a campaign, from the whole list otherwise. ---- */
    function swapAllowance(side) {
      var n = E.state.units.filter(function (u) { return u.side === side && u.pickIdx != null; }).length;
      return R.swapAllowance(n, docsOf(side).indexOf('O6') >= 0);
    }
    function swapOptions(side, u) {
      var up = u && R.profile(u.key);
      /* Any unit for one "of the same Unit Tier" (p. 46), a Command Unit included —
         save in a campaign, where the company's field command is not on the bench. */
      if (!u || u.pickIdx == null || !up || up.leaderBug || up.turretSet) return [];
      if (u.command && E.state.cfg.dossier) return [];
      if (u.aboard || (u.cargo && u.cargo.length)) return [];      // already strapped into a drop pod, or carrying one
      var cfg = E.state.cfg, held = heldSwaps(side);
      if (held.some(function (d) { return d.outId === u.id; })) return [];   // already down to be swapped
      if (cfg.dossier) {
        return ((cfg.bench && cfg.bench[side]) || []).filter(function (e) {
          var p = R.profile(e.key); return p && p.tier === u.tier && !p.command && !p.turretSet &&
            !held.some(function (d) { return d.entry === e; });
        }).map(function (e) { return { id: e.rid, key: R.entryPick(e), name: e.name, entry: e }; });
      }
      // one Command Unit a Priority Level (p. 57): another comes in only in place of one, or under the cap
      var goingOut = held.map(function (d) { return d.outId; });
      var cmds = E.state.units.filter(function (o) {
        return o.side === side && o.command && o.pickIdx != null && goingOut.indexOf(o.id) < 0;
      }).length + held.filter(function (d) { var hp = R.profile(R.splitPick(d.key || '').key); return hp && hp.command; }).length;
      var cmdRoom = u.command || cmds < (cfg.pl || 1);
      return R.listFor(u.faction).filter(function (p) {
        return p.tier === u.tier && (!p.command || cmdRoom) && !p.turretSet && !p.noSlot && p.key !== u.key && !p.leaderBug;
      }).map(function (p) { return { id: p.key, key: p.key, name: p.name, entry: null }; });
    }
    /* Each player's allowance, offered on the deployment card until they put their
       first unit down: opening it (swapopen) brings up the swap card, and placing
       a unit means the list stands as it is. */
    /* A scenario that holds part of a force back — Invasion's second wave, the
       defenders' reserves — can only hold units free to be held: an emplaced gun
       "cannot be held in reserve" (p. 94). How many more such units a side's list
       needs than it has (counting the swaps it has noted), so that the split can
       be made as the scenario asks. */
    function gun(key) { var p = R.profile(R.splitPick(key || '').key); return !!(p && (p.rules || []).indexOf('Stationary Artillery') >= 0); }
    function splitShort(side) {
      var sp = E.state.sc && E.state.sc.split && E.state.sc.split[side];
      if (!sp || !sp.want) return 0;
      var pend = {};
      heldSwaps(side).forEach(function (d) { pend[d.outId] = d.key; });
      var rule = E.SC.gunRule(E.state, side);
      if (rule === 'drop') return 0;                        // guns drop in either wave
      var guns = 0, tows = 0, free = 0;
      sp.ids.forEach(function (id) {
        var u = byId(id);
        if (!u || !u.alive) return;
        var p = pend[id] ? R.profile(R.splitPick(pend[id]).key) : u;
        if (pend[id] ? gun(pend[id]) : R.has(u, 'Stationary Artillery')) { guns++; return; }
        free++;
        if (R.canTow(p)) tows++;
      });
      /* An Invasion defender may hold a gun back behind a transport vehicle held
         with it: one for each such hull in the force (SC.gunRule). */
      if (rule === 'tow') free += Math.min(guns, tows);
      return Math.max(0, sp.want - free);
    }
    // a gun in the split that could be swapped for a unit free to be held
    function gunsOut(side) {
      var sp = E.state.sc && E.state.sc.split && E.state.sc.split[side];
      if (!sp) return [];
      var pend = {};
      heldSwaps(side).forEach(function (d) { pend[d.outId] = true; });
      return sp.ids.map(byId).filter(function (u) {
        return u && u.alive && !pend[u.id] && R.has(u, 'Stationary Artillery') &&
          swapOptions(side, u).some(function (o) { return !gun(o.key); });
      });
    }
    // why a player may not go on yet, or null: the guns their split cannot carry
    function swapBlock(side) {
      if (isAI(side) || !E.state.swapAvail || !E.state.swapAvail[side]) return null;
      var n = splitShort(side);
      if (!n || !gunsOut(side).length) return null;
      return 'Emplaced guns cannot be held back, and the scenario holds back part of the force: swap ' + n +
        ' more gun' + (n === 1 ? '' : 's') + ' for unit' + (n === 1 ? '' : 's') + ' of the same Tier first.';
    }
    // the AI makes its own swaps for the split: a gun out for the first unit of its Tier that is not one
    function aiSplitSwaps(sd) {
      var made = [], guard = 0;
      while (splitShort(sd) > 0 && guard++ < 20) {
        var g = gunsOut(sd)[0];
        if (!g) break;
        var opt = swapOptions(sd, g).filter(function (o) { return !gun(o.key); })[0];
        var sa = { side: sd, left: 1, total: 1, pick: null, done: [] };
        applySwap(sd, g, opt, sa);
        made.push(sa.done[0]);
      }
      /* the units swapped in took the guns' places, in the first wave: the split is
         made up again, units free to be held put into the held-back part until it
         has the scenario's share */
      if (made.length) {
        var sp = E.state.sc.split[sd], us = sp.ids.map(byId).filter(function (u) { return u && u.alive; });
        var heldN = us.filter(function (u) { return u.wave === 2; }).length;
        us.forEach(function (u) {
          if (heldN >= sp.want || u.wave === 2 || R.has(u, 'Stationary Artillery') || u.aboard) return;
          u.reserve = true; u.wave = 2; u.x = -1; u.y = -1; heldN++;
        });
        // a gun still over the table's share goes behind a held transport vehicle, or stays out
        us.forEach(function (u) {
          if (heldN >= sp.want || u.wave === 2 || u.aboard || !R.has(u, 'Stationary Artillery') || !E.SC.freeToHold(E.state, u)) return;
          var tow = E.SC.gunRule(E.state, sd) === 'tow' && us.filter(function (v) {
            return v.wave === 2 && R.canTow(v) && !R.towedGuns(v).length && (v.cargo || []).length < v.transport;
          })[0];
          if (tow) { tow.cargo = (tow.cargo || []).concat([u]); u.aboard = tow.id; u.reserve = false; }
          else u.reserve = true;
          u.wave = 2; u.x = -1; u.y = -1; heldN++;
        });
      }
      if (made.length) pushRes({ kind: 'Modifying the armies', title: sideName(sd), side: sd,
        note: 'Emplaced guns cannot be held back, and the scenario holds back part of the force (p. 94).',
        list: made.map(function (d) { return { text: d.out + ' \u2192 ' + d.in, side: sd }; }) });
      refreshSplit(sd);
    }
    // the split's own limits, once its units have changed
    function refreshSplit(side) {
      var sp = E.state.sc && E.state.sc.split && E.state.sc.split[side];
      if (!sp || sp.want == null) return;
      var us = sp.ids.map(byId).filter(function (u) { return u && u.alive; });
      var held = us.filter(function (u) { return u.wave === 2 || u.reserve; }).length;
      var free = us.filter(function (u) { return E.SC.freeToHold(E.state, u); }).length;
      sp.min = Math.min(sp.want, Math.max(held, Math.min(sp.want, free)));
      sp.max = Math.max(Math.min(sp.wantMax, free), held);
    }
    function beginSwaps() {
      E.state.swapAvail = {};
      E.state.swapStage = null;
      if (E.state.solo) return;
      ['A', 'B'].forEach(function (sd) { if (isAI(sd)) aiSplitSwaps(sd); });
      if (E.state.cfg.noSwap) return;
      ['A', 'B'].forEach(function (sd) {
        if (isAI(sd)) return;
        // as many swaps as the guns the split cannot carry, if that is more than the usual share
        var need = gunsOut(sd).length ? Math.min(splitShort(sd), gunsOut(sd).length) : 0;
        var n = Math.max(swapAllowance(sd), need);
        if (n < 1) return;
        if (!E.state.units.some(function (u) { return u.side === sd && swapOptions(sd, u).length; })) return;
        E.state.swapAvail[sd] = { side: sd, left: n, total: n, pick: null, done: [], forced: need };
      });
      /* In a hotseat both players modify their armies in secret, one after the
         other, before anyone deploys: each swap is held back until both are done,
         so the second player sees the first one's force as it was mustered. */
      if (E.state.cfg.secretSwaps) {
        var order = ['A', 'B'].filter(function (sd) { return E.state.swapAvail[sd]; });
        if (order.length) {
          E.state.swapStage = { order: order, i: 0 };
          E.state.swapAsk = E.state.swapAvail[order[0]];
          E.state.swapAsk.pick = null;
        }
        return;
      }
      /* Otherwise each player with a swap to make says when they are done with
         it (Continue to deployment), and nobody deploys until every one has:
         a unit going down is not something the other player may see while
         still choosing their list. */
      var wait = {}, any = false;
      E.state.swapHold = false;
      if (!E.state.cfg.readyUp) { E.state.deployReady = null; return; }   // asked for by the screen or the server that runs the game
      ['A', 'B'].forEach(function (sd) { if (E.state.swapAvail[sd]) { wait[sd] = false; any = true; } });
      E.state.deployReady = any ? wait : null;
      /* The swaps are made in secret here too: noted as they are chosen, and made,
         and said, only once every player has gone on to the deployment. */
      E.state.swapHold = any;
    }
    // swaps noted but not yet made: a hotseat's secret round, or until every player is ready
    function holding() { return !!(E.state.swapStage || E.state.swapHold); }
    // the sides still choosing whether to modify their armies, before anyone deploys
    function stillChoosing() {
      var r = E.state.deployReady;
      return r ? ['A', 'B'].filter(function (sd) { return r[sd] === false; }) : [];
    }
    // done with it: the list stands (any swap left is given up)
    function readyToDeploy(side) {
      var r = E.state.deployReady;
      if (!r || r[side] !== false) return;
      r[side] = true;
      if (E.state.swapAsk && E.state.swapAsk.side === side) swapsDone();
      if (!stillChoosing().length) {
        E.state.deployReady = null;
        if (E.state.swapHold) { E.state.swapHold = false; revealSwaps(['A', 'B'], 'Swapped in secret for units of the same Tier before deployment (p. 46).'); }
      }
      render();
    }
    /* Every swap held back, made at once, and each side's said in a card of its own. */
    function revealSwaps(order, note) {
      order.forEach(function (sd) {
        var s2 = E.state.swapAvail && E.state.swapAvail[sd];
        if (!s2) return;
        s2.done.filter(function (x) { return x.held; }).forEach(function (x) {
          var old = byId(x.outId);
          applySwap(sd, old, { id: x.entry ? x.entry.rid : x.key, key: x.key, name: x.in, entry: x.entry }, s2);
        });
        E.state.swapAvail[sd] = null;
        if (s2.done.length) pushRes({ kind: 'Modifying the armies', title: sideName(sd), side: sd,
          note: note, list: s2.done.map(function (x) { return { text: x.out + ' \u2192 ' + x.in, side: sd }; }) });
      });
    }
    // the swaps a side has made but not yet revealed, in a hotseat's secret round
    function heldSwaps(side) {
      var sa = holding() && E.state.swapAvail && E.state.swapAvail[side];
      return sa ? sa.done.filter(function (d) { return d.held; }) : [];
    }
    function canSwapNow(side) {
      if (E.state.swapStage) return false;             // the secret round asks each player in turn
      var sa = E.state.swapAvail && E.state.swapAvail[side];
      if (E.state.deployReady && E.state.deployReady[side] === true) return false;   // gone on: the list stands
      /* Until they go on, a player may close the swaps to look at the table and
         come back, and change a swap already noted: nothing is made until then. */
      var more = sa && (sa.left > 0 || (E.state.swapHold && heldSwaps(side).length));
      return !!more && E.state.phase === 'deploy' &&
        !E.state.units.some(function (u) { return u.side === side && u.x >= 0; });
    }
    function legalList(side, keys) {
      var cfg = E.state.cfg;
      return R.checkArmy(keys, cfg.tier, cfg.pl, docsOf(side), E.state.tactics && E.state.tactics[side], null);
    }
    function doSwap(side, outId, inId) {
      var sa = E.state.swapAsk;
      var old = byId(outId);
      if (!sa || sa.side !== side || sa.left < 1) return 'No swaps left.';
      if (!old || old.side !== side) return 'Not one of yours.';
      var opt = swapOptions(side, old).filter(function (o) { return o.id === inId; })[0];
      if (!opt) return 'That cannot be swapped in for it.';
      var short = splitShort(side);
      if (short && sa.left <= short && gunsOut(side).length && (!R.has(old, 'Stationary Artillery') || gun(opt.key))) {
        return 'The swaps left are wanted for the guns: an emplaced gun out, for a unit that can be held back.';
      }
      var cfg = E.state.cfg, armyKey = side === 'A' ? 'armyA' : 'armyB';
      var keys = cfg[armyKey].slice(), i = old.pickIdx;
      heldSwaps(side).forEach(function (d) { keys[byId(d.outId).pickIdx] = d.key; });
      var before = legalList(side, keys).ok;
      keys[i] = opt.key;
      var chk = legalList(side, keys);
      if (before && !chk.ok) return chk.faults[0] || 'That would make the list illegal.';
      if (holding()) {
        // in secret: noted now, made when both players are done
        sa.left--; sa.pick = null;
        sa.done.push({ out: old.name, in: opt.name, outId: old.id, key: opt.key, entry: opt.entry, held: true });
        // a hotseat's secret round moves on to the next player; otherwise the swaps stay open, to be changed
        if (sa.left < 1 && E.state.swapStage) { swapsDone(); return null; }
        render();
        return null;
      }
      applySwap(side, old, opt, sa);
      sa.left--; sa.pick = null;
      if (sa.left < 1) { swapsDone(); return null; }
      render();
      return null;
    }
    // a swap noted but not yet made, taken back: the unit stays, and the swap is free again
    function undoSwap(side, outId) {
      var sa = E.state.swapAsk;
      if (!sa || sa.side !== side || !holding()) return 'That swap has already been made.';
      var i = -1;
      sa.done.forEach(function (d, k) { if (d.held && d.outId === outId) i = k; });
      if (i < 0) return 'That unit is not down to be swapped.';
      sa.done.splice(i, 1);
      sa.left++; sa.pick = null;
      render();
      return null;
    }
    function applySwap(side, old, opt, sa) {
      var cfg = E.state.cfg, armyKey = side === 'A' ? 'armyA' : 'armyB', i = old.pickIdx;
      var pick = R.splitPick(opt.key), prof = R.profile(pick.key);
      var nu = makeUnit(prof, side, i, pick.prop || R.defaultDrive(prof), pick.drone, opt.entry, pick.riders);
      nu.id = old.id + 's' + (sa.done.length + 1);
      nu.pickIdx = i;
      if (R.canMount(prof, pick.riders)) R.applyMount(nu, pick.mount || 'none');
      nu.startSize = nu.models;
      // it takes the old unit's place in the army: its id, and whatever the scenario made of it
      nu.id = old.id;
      ['reserve', 'wave', 'owner', 'paint', 'x', 'y'].forEach(function (k) { if (old[k] !== undefined) nu[k] = old[k]; });
      E.state.units[E.state.units.indexOf(old)] = nu;
      cfg[armyKey][i] = opt.key;
      if (cfg.dossier) {
        var was = cfg.dossier[side][i];
        cfg.dossier[side][i] = opt.entry;
        var bench = cfg.bench[side];
        bench.splice(bench.indexOf(opt.entry), 1);
        if (was) bench.push(was);
      }
      var d = sa.done.filter(function (x) { return x.held && x.outId === old.id; })[0];
      if (d) { d.held = false; d.in = nu.name; }
      else sa.done.push({ out: old.name, in: nu.name });
      logLine('note', sideName(side) + ' swaps ' + old.name + ' for ' + nu.name + '.');
      refreshSplit(side);
    }
    function swapsDone() {
      var sa = E.state.swapAsk;
      E.state.swapAsk = null;
      var stg = E.state.swapStage;
      if (stg) {
        // the next player's turn to modify theirs, or, with both done, every swap made at once
        if (++stg.i < stg.order.length) {
          E.state.swapAsk = E.state.swapAvail[stg.order[stg.i]];
          E.state.swapAsk.pick = null;
          render();
          return;
        }
        E.state.swapStage = null;
        revealSwaps(stg.order, 'Swapped in secret for units of the same Tier before deployment (p. 46).');
        lookAtDeployment();
        render();
        return;
      }
      // held until every player is ready: the swaps are made, and said, then (readyToDeploy)
      if (sa && E.state.swapHold) { render(); return; }
      if (sa) {
        E.state.swapAvail[sa.side] = null;
        if (sa.done.length) pushRes({ kind: 'Modifying the armies', title: sideName(sa.side), side: sa.side,
          note: 'Swapped for units of the same Tier before deployment (p. 46).',
          list: sa.done.map(function (d) { return { text: d.out + ' → ' + d.in, side: sa.side }; }) });
      }
      render();
    }

    return {
      swapOptions: swapOptions, beginSwaps: beginSwaps, canSwapNow: canSwapNow, doSwap: doSwap, undoSwap: undoSwap,
      swapsDone: swapsDone, stillChoosing: stillChoosing, readyToDeploy: readyToDeploy,
      swapBlock: swapBlock, splitShort: splitShort
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCEngineSwaps;
})(typeof window !== 'undefined' ? window : global);
