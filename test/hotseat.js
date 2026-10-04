/* A hotseat battle played to the end in the browser (the hotseat review, phase 6),
   as two players at one screen would: every pass-the-device card tapped, every
   question answered from the card on the screen by the player it is put to, set-up
   gone through side by side, and every activation taken through the board's own
   hooks (select, an action, commit to a target or a spot) — nothing reaches into
   the engine. Each step is one look at the page; the helper says what it did, so a
   battle that stops says where. */
'use strict';

/* A battle laid out as the menu's hotseat skirmish lays one out (muster.js): the
   two forces rolled for their factions, the secret round of swaps on. */
async function startHotseat(page, o) {
  await page.evaluate((o) => {
    if (window.PMCMenu) window.PMCMenu.close();
    const R = window.PMC;
    const tier = o.tier || 3, pl = o.pl || 1, fa = o.factionA || 'pmc', fb = o.factionB || 'rebel';
    window.PMC_NEWGAME({
      tier: tier, pl: pl, scenario: o.scenario || 'meeting', mode: 'hotseat', secretSwaps: true,
      armyA: o.armyA || R.rollArmy(tier, pl, null, fa), armyB: o.armyB || R.rollArmy(tier, pl, null, fb),
      nameA: o.nameA || 'Player One', nameB: o.nameB || 'Player Two', colourA: 'ochre', colourB: 'steel',
      factionA: fa, factionB: fb, tactics: { A: null, B: null },
      planet: o.planet || 'sparse', terrainSetup: o.terrain || 'auto'
    });
  }, o || {});
  await page.waitForTimeout(700);
}

/* A co-operative game as the menu starts one: each player's commando mustered
   (rolled), the solitaire scenario chosen, then Take the field. */
async function startCoop(page, o) {
  o = o || {};
  const next = async () => { await page.evaluate(() => document.getElementById('btn-start').click()); await page.waitForTimeout(250); };
  const roll = () => page.evaluate(() => document.querySelector('[data-army="roll"]').click());
  await page.evaluate(() => { if (window.PMCMenu) window.PMCMenu.close(); window.PMC_SKIRMISH('coop'); });
  await page.waitForTimeout(250);
  await next();                                       // an empty commando opens itself
  await roll(); await next();
  await page.evaluate(() => document.querySelector('[data-hotside="1"]').click()); await page.waitForTimeout(250);
  if (o.factionB) await page.evaluate((f) => { const s = document.getElementById('sel-faction'); s.value = f; s.dispatchEvent(new Event('change', { bubbles: true })); }, o.factionB);
  await roll(); await next();
  if (o.scenario) await page.evaluate((v) => { const s = document.getElementById('sel-solo-scen'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, o.scenario);
  await next();
  await page.waitForTimeout(700);
}

/* One step: the first thing on the screen that wants answering, answered. Run in
   the page. Returns what was done ('over' once there is a result). */
function step() {
  const W = window, s = W.PMC_STATE(), $ = (q) => document.querySelector(q);
  const press = (act) => { const b = $('#context [data-act="' + act + '"]:not([disabled]), [data-act="' + act + '"]:not([disabled])'); if (b) { b.click(); return true; } return false; };
  if (!s) return 'no battle';
  if (s.over) return 'over';
  const ho = $('#handover'); if (ho && !ho.hidden) { ho.click(); return s.phase === 'battle' ? 'handover in battle' : 'handover'; }
  const om = $('#obj-modal'); if (om && !om.hidden) { const d = $('#obj-done'); if (d) d.click(); return 'briefing'; }
  const rs = $('#resolution'); if (rs && !rs.hidden) { const c = $('#res-continue'); if (c) c.click(); return 'card'; }
  if (W.__busy() || W.__showQueue() > 0) return 'busy';
  // a rebel's tactic: none (a Human Wave's units, if one is called, are picked for it)
  if (s.tacticAsk) {
    if (s.tacticAsk.wave) { if (!press('wavedone')) press('waveauto'); return 'wave'; }
    W.__sendIntent({ k: 'tactic', tactic: null }); return 'tactic';
  }
  // questions put to a player: each declined, the End phase carried on
  for (const act of ['vfaceall', 'enddone', 'nokyf', 'nomartyr', 'nonervous', 'nostand', 'cmdskip', 'rpickdone', 'relocdone', 'nomine']) {
    if (press(act)) return act;
  }
  // pieces to place: put down where they are offered, then done
  if (s.placeAsk) { if (!press('placeauto')) press('placedone'); return 'place'; }
  // the secret round of swaps: nothing swapped, each player done in turn
  const sd = $('[data-act="swapdone"]:not([disabled])');
  if (sd) { sd.click(); return 'swapdone ' + (sd.getAttribute('data-who') || ''); }
  if (s.phase === 'deploy') {
    if (press('deployready')) return 'deployready';
    // an insertion of a unit held off the table: put down where it can go, or held
    const ins = W.__insertionState && W.__insertionState();
    if (ins) { const sp = W.__insertionSpotsNow(); if (sp && sp.length) W.__dropHere(sp[0]); else W.__holdInsertion(); return 'insert'; }
    if (!W.__deployDone()) { W.__autoDeployBoth(); return 'deploy'; }
    const go = W.__beginButton(); if (go && !go.disabled) { go.click(); return 'begin'; }
    return 'deploy wait';
  }
  if (s.phase !== 'battle') return 'phase ' + s.phase;
  const ins = W.__insertionState && W.__insertionState();
  if (ins) { const sp = W.__insertionSpotsNow(); if (sp && sp.length) W.__dropHere(sp[0]); else W.__holdInsertion(); return 'insert'; }
  // an activation: the first unit able to act does the first thing it can that ends its turn
  // the AI's side (a co-op game's OpFor) plays itself
  if ((s.cfg.aiSides || []).indexOf(s.activeSide) >= 0) return 'ai';
  /* A card still being read (one in the rail stays "open" for a moment as it is
     written), or the last move still being drawn: the player waits, as the board
     does — the End phase's question is not put until the rally's cards are done
     (panels.js), and nothing is this screen's to do mid-replay (game.js mySide). */
  if (W.__resOpen() || !W.__mySide()) return 'busy';
  /* A question still owed that no button above answered: nobody acts until it
     is (engine.js mayAct) — the units the End phase finds unactivated (rallied
     from Broken) included. Waited for; one that never comes is caught as a repeat. */
  const owed = ['endAsk', 'faceAsk', 'standAsk', 'cmdOffer', 'martyrAsk', 'kyfAsk', 'nervousAsk', 'relocating', 'placeAsk'].filter((k) => s[k])[0];
  if (owed) return 'waiting on ' + owed;
  const list = W.__eligibleUnits();
  if (!list.length) return 'nothing to act';
  const u = list[0];
  const fp = () => { const t = W.PMC_STATE(); return [t.turn, t.activeSide, t.units.filter((x) => x.activated).length, t.units.filter((x) => x.alive).length, !!t.over].join('/'); };
  W.__lastRefusal = null;
  if (!W.__select(u)) return 'stuck: could not select ' + u.name + (W.__lastRefusal ? ' (' + W.__lastRefusal.why + ')' : '');
  const was = fp();
  for (const id of W.__actionIds(u)) {
    if (!W.__pressAction(id)) continue;
    if (fp() !== was || W.__busy() || W.__showQueue() > 0) return 'act ' + u.side + ' ' + id;
    if (W.__commitWhatever() && (fp() !== was || W.__busy() || W.__showQueue() > 0)) return 'act ' + u.side + ' ' + id + '+';
    W.__pressCancel();
  }
  return 'stuck: ' + u.name + ' [' + u.side + '] had nothing that ended its activation (' +
    W.__actionIds(u).map((id) => { const a = W.__actionState(id); return (a.on ? '+' : '-') + id + (a.on ? '' : ': ' + a.hint); }).join('; ') +
    ', mode ' + JSON.stringify(W.__uiMode()) + ', turn ' + s.turn + ')';
}

/* Played to the end, or until it stops. `opts.reloadAt`: after this many
   activations, reload the page and pick the battle up again from the menu.
   Returns { over, winner, turns, acts, passes (devices handed over), sides (activations
   each), reloaded, stuck, log (the last steps) }. */
async function playToEnd(page, opts) {
  opts = opts || {};
  const limit = opts.steps || 4000, log = [];
  let acts = 0, passes = 0, battlePasses = 0, reloaded = false, same = 0, last = '';
  const sides = { A: 0, B: 0 };
  for (let i = 0; i < limit; i++) {
    const did = await page.evaluate(step);
    if (did !== 'busy' && did !== 'card' && did !== 'ai') { log.push(did); if (log.length > 40) log.shift(); }
    if (did === 'over') break;
    if (/^stuck/.test(did)) return { over: false, stuck: did, log: log, acts: acts, passes: passes, battlePasses: battlePasses, sides: sides, reloaded: reloaded };
    if (/^act /.test(did)) { acts++; sides[did.charAt(4)] = (sides[did.charAt(4)] || 0) + 1; }
    if (did === 'handover' || did === 'handover in battle') passes++;
    if (did === 'handover in battle') battlePasses++;
    // the same thing done over and over, with nothing changing: stopped
    same = did === last && did !== 'busy' && did !== 'card' && did !== 'ai' ? same + 1 : 0; last = did;
    if (same > 30) return { over: false, stuck: 'repeating: ' + did, log: log, acts: acts, passes: passes, battlePasses: battlePasses, sides: sides, reloaded: reloaded };
    if (opts.reloadAt && !reloaded && acts >= opts.reloadAt) {
      reloaded = true;
      await page.reload();
      // the page up (however busy the machine), then the battle picked up from where it was kept
      await page.waitForFunction(() => !!(window.PMCNet && window.PMC_RESUME_BATTLE && window.PMCMenu), null, { timeout: 30000 }).catch(() => {});
      for (let i = 0; i < 20; i++) {
        const back = await page.evaluate(() => { if (window.PMC_STATE && window.PMC_STATE()) return true; const b = window.PMCNet.savedBattles()[0]; if (b) window.PMC_RESUME_BATTLE(b.id); return !!(window.PMC_STATE && window.PMC_STATE()); });
        if (back) break;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(600);
      log.push('reloaded');
      continue;
    }
    await page.waitForTimeout(did === 'busy' || did === 'ai' ? 60 : 30);
  }
  const end = await page.evaluate(() => { const s = window.PMC_STATE(); return s ? { over: !!s.over, winner: s.over ? s.over.winner : undefined, turns: s.turn } : { over: false }; });
  return Object.assign(end, { acts: acts, passes: passes, battlePasses: battlePasses, sides: sides, reloaded: reloaded, log: log, stuck: end.over ? null : 'ran out of steps' });
}

module.exports = { startHotseat: startHotseat, startCoop: startCoop, playToEnd: playToEnd, step: step };
