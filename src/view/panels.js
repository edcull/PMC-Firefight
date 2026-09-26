/* PMC 2670 — Firefight : the panels: the action bar, the drawer, the stat strip and the side panel.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCPanels = function (B) {
    var actionState = B.actionState, autoDeployMine = B.autoDeployMine, boardableFor = B.boardableFor;
    var byId = B.byId, cancelPreview = B.cancelPreview, carriersFor = B.carriersFor;
    var chooseAction = B.chooseAction, cmdOfferCard = B.cmdOfferCard, commitMove = B.commitMove;
    var curArea = B.curArea, deployNext = B.deployNext, deployRoster = B.deployRoster;
    var deployWhere = B.deployWhere, deploymentDone = B.deploymentDone, digFacings = B.digFacings;
    var digPreview = B.digPreview, doAssault = B.doAssault, doBreach = B.doBreach, doDemolish = B.doDemolish;
    var doDesignate = B.doDesignate, doEnter = B.doEnter, doHack = B.doHack, doShoot = B.doShoot;
    var doSteady = B.doSteady, doSupport = B.doSupport, drawBoard = B.drawBoard;
    var emptyPlatforms = B.emptyPlatforms, holdArrival = B.holdArrival, holdInsertion = B.holdInsertion;
    var hud = B.hud, inReserve = B.inReserve, insertionCard = B.insertionCard, isAI = B.isAI;
    var kyfCard = B.kyfCard, liftOf = B.liftOf, loadBefore = B.loadBefore, martyrCard = B.martyrCard;
    var mineCard = B.mineCard, movePreviewCard = B.movePreviewCard, mySide = B.mySide, openMenu = B.openMenu;
    var pickToDeploy = B.pickToDeploy, placeCard = B.placeCard, placingSide = B.placingSide;
    var playerSide = B.playerSide, relocPick = B.relocPick, render = B.render, roleOf = B.roleOf;
    var roleSentence = B.roleSentence, select = B.select, send = B.send, shownAs = B.shownAs;
    var sideName = B.sideName, soloOwnerName = B.soloOwnerName, specialsFor = B.specialsFor;
    var splitFor = B.splitFor, startBattle = B.startBattle, swapCard = B.swapCard, terrainAct = B.terrainAct;
    var terrainBits = B.terrainBits, terrainCard = B.terrainCard, terrainMark = B.terrainMark;
    var unloadBefore = B.unloadBefore, C = B.C, DIG_NAMES = B.DIG_NAMES, ICONS = B.ICONS, ISO = B.ISO;
    var PIECE_NOUN = B.PIECE_NOUN, R = B.R, SFX = B.SFX, SPECIAL_SLOTS = B.SPECIAL_SLOTS;
    var STANDARD = B.STANDARD, TERRAIN_MARK = B.TERRAIN_MARK, UR = B.UR, el = B.el, ui = B.ui;
    function setMTab() { return B.setMTab.apply(this, arguments); }
    function openObjectives() { return B.openObjectives.apply(this, arguments); }
    function closeRes() { return B.closeRes.apply(this, arguments); }

    /* ---------- action bar ---------- */
    function drawBar() {
      var u = ui.selected, bar = el('bar');
      var specials = specialsFor(u);
      var html = '';

      STANDARD.forEach(function (a, n) {
        var st = actionState(u, a.id);
        var active = ui.mode === a.id || (a.id === 'advance' && (ui.mode === 'advance-move' || ui.mode === 'advance-fire'));
        html += '<button class="slot' + (active ? ' active' : '') + '" data-action="' + a.id + '"' +
          (st.on ? '' : ' disabled') + ' title="' + a.label + ' — ' + st.hint.replace(/"/g, '&quot;') + '">' +
          '<kbd>' + (n + 1) + '</kbd>' + ICONS[a.id] + '<span>' + a.label + '</span></button>';
      });
      for (var s = 0; s < SPECIAL_SLOTS; s++) {
        var sp = specials[s];
        if (!sp) {
          html += '<button class="slot special empty" disabled title="Special action slot"><span style="opacity:.6">' + ICONS.empty + '</span><span>—</span></button>';
        } else {
          var st2 = actionState(u, sp.id);
          html += '<button class="slot special' + (ui.mode === sp.id ? ' active' : '') + '" data-action="' + sp.id + '"' +
            (st2.on ? '' : ' disabled') + ' title="' + sp.label + ' — ' + st2.hint.replace(/"/g, '&quot;') + '">' +
            (ICONS[sp.id] || '') + '<span>' + sp.label + '</span></button>';
        }
      }
      bar.innerHTML = html;

      bar.querySelectorAll('[data-action]').forEach(function (b) {
        var id = b.getAttribute('data-action');
        b.addEventListener('click', function () { if (SFX) SFX.click(); chooseAction(id); });
        b.addEventListener('mouseenter', function () { setHint(id); });
        b.addEventListener('mouseleave', function () { setHint(null); });
        b.addEventListener('focus', function () { setHint(id); });
      });
      setHint(null);
    }

    function setHint(id, override) {
      ui.hint = id;
      var u = ui.selected, box = el('hintbar');
      // the standing prompt, and only that, is marked idle: a phone hides it to give the room to the panes
      box.classList.remove('idle');
      if (override) { box.textContent = override; return; }
      if (id) {
        var all = STANDARD.concat(specialsFor(u));
        var a = all.filter(function (x) { return x.id === id; })[0];
        var st = actionState(u, id);
        box.innerHTML = '<b>' + (a ? a.label : id) + '</b> — ' + st.hint;
        return;
      }
      if (B.state.over) { box.textContent = B.state.over.text; return; }
      if (B.state.phase === 'terrain') {
        var ta = curArea(), tg = B.state.tset && B.state.tset.ghost;
        box.innerHTML = !ta ? 'Setting the table…'
          : isAI(ta.side) ? esc(sideName(ta.side)) + ' is laying the ' + ta.name + ' area.'
            : !tg ? 'Choose what the ' + ta.name + ' roll gives, in the panel.'
              : 'Tap inside the lit <b>' + ta.name + '</b> area to put down the ' + (PIECE_NOUN[tg.kind] || [tg.kind])[0] + ' outlined under the pointer.';
        return;
      }
      if (B.state.phase === 'deploy') {
        var next = deployNext(), dside = placingSide();
        // somebody else's deployment is watched, not played
        if (next && dside && !mySide()) {
          box.innerHTML = '<b>' + esc(sideName(dside)) + '</b> is putting its force down.';
          return;
        }
        box.innerHTML = next
          ? 'Placing <b>' + esc(next.name) + '</b> — click inside your shaded strip, or pick a different unit from the order of battle. ' +
          'Tapping a model already down picks it up to shift.'
          : 'All units are on the table. Begin the battle from the panel.';
        return;
      }
      if (!u && B.state.solo && B.state.activeSide === 'B') { box.textContent = 'OpFor phase — the enemy acts, furthest from your forces first.'; return; }
      if (!u && B.state.solo && B.state.solo.coop) {
        box.innerHTML = '<b>' + esc(soloOwnerName(B.state.activeOwner)) + '</b>: select one of your units — the players take turns, one activation each.';
        return;
      }
      if (!u) {
        box.textContent = 'Select one of your units on the table — those not shaded darker have still to act.';
        box.classList.add('idle');
        return;
      }
      if (ui.mode === 'carry-first') {
        box.innerHTML = '<b>' + u.name + '</b> drives up to half its Movement first — tap the shaded ground; then Embark or Disembark.';
      } else if (ui.mode === 'carry-move') {
        box.innerHTML = '<b>' + u.name + '</b> may now drive up to half its Movement — tap the shaded ground, or press any action to stay put.';
      } else if (ui.mode === 'move' || ui.mode === 'advance-move') {
        box.innerHTML = 'Click anywhere in the shaded ground to move <b>' + u.name + '</b> there.';
      } else if (ui.mode === 'fire' || ui.mode === 'aux' || ui.mode === 'advance-fire') {
        box.innerHTML = 'Pick a target — ringed units are in range and sight.';
      } else if (ui.mode === 'assault') {
        box.innerHTML = 'Pick the unit to charge. The defender fires first, at Basic Firepower.';
      } else if (ui.mode === 'breach') {
        box.innerHTML = 'Pick what to charge — tap the outlined structure on the table, or a line in the panel below. ' +
          '<b>' + esc(u.name) + '</b> walks up to it and sets the charges as an Assault.';
      } else if (ui.mode === 'demolish') {
        box.innerHTML = 'Pick what to shoot down — tap the outlined structure on the table, or a line in the panel below.';
      } else if (ui.mode === 'designate') {
        box.innerHTML = 'Pick the enemy to mark for the rest of the turn.';
      } else if (ui.mode === 'wave') {
        box.innerHTML = 'Psychic Wave: tap where <b>' + esc(u.name) + '</b> moves to — or the unit itself to stay — and every enemy within 12" of it takes D6−1 SP.';
      } else if (isAI(u.side)) {
        box.innerHTML = '';                              // the OpFor's own: nothing to say about it here
      } else {
        box.innerHTML = '<b>' + u.name + '</b> — ' + (u.activated ? 'already acted this turn.' :
          u.side === B.state.activeSide ? 'choose an action.' : 'waiting for its activation.');
      }
    }

    /* ---------- drawer ---------- */
    function drawerEl() { return el('drawer'); }
    function openDrawer(tab) {
      var d = drawerEl();
      if (tab) setDrawerTab(tab);
      d.classList.add('open');
      el('scrim').hidden = false;
      if (SFX) SFX.click();
    }
    function closeDrawer() {
      var d = drawerEl();
      if (!d.classList.contains('open')) return;
      d.classList.remove('open');
      el('scrim').hidden = true;
    }
    function toggleDrawer() {
      if (drawerEl().classList.contains('open')) closeDrawer(); else openDrawer();
    }
    function setDrawerTab(tab) {
      var d = drawerEl();
      d.classList.remove('tab-forces', 'tab-log');
      d.classList.add('tab-' + tab);
      d.querySelectorAll('.dtab').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-tab') === tab);
      });
      if (tab === 'log') { var lb = el('log'); lb.parentElement.scrollTop = lb.parentElement.scrollHeight; }
    }

    /* ---------- stat strip ---------- */
    /* The selected unit's card is shown twice on a desktop — in the left rail and
       under the board — and once on a phone. Both hosts are filled; CSS decides
       which is on screen. */
    function drawStats() {
      statsInto(el('statstrip'));
      statsInto(el('statstrip-side'));
    }
    function statsInto(box) {
      if (!box) return;
      var u = ui.selected && shownAs(ui.selected);
      // keep whatever the layout put on it; only the statstrip's own state changes
      var keep = (box.getAttribute('data-keep') || '').trim();
      if (!keep) {
        keep = box.className.split(/\s+/).filter(function (c) { return c !== 'compact' && c !== 'statstrip'; }).join(' ');
        box.setAttribute('data-keep', keep);
      }
      box.className = (keep ? keep + ' ' : '') + 'statstrip';   // always in full: no Details to tap for it
      if (!u) {
        box._html = null;
        box.innerHTML = '<p class="hint small">No unit selected. Stats, suppression and special rules appear here.</p>';
        return;
      }
      if (R.isMachine(u)) { drawMachineStats(u, box); return; }
      var st = R.status(u), m = R.currentMorale(u);
      var h = '<div class="stat-head"><span class="code code-' + u.side + '"' + armyStyle(u.side) + '>' + u.code + '</span>' +
        '<div class="sh-text"><h2>' + u.name + honourMarks(u) + '</h2><span class="sub">Tier ' + u.tier + groupOf(u) + '</span></div>' +
        '</div>';
      /* Suppression against Morale in three equal bands — steady, suppressed,
         broken — each as wide as the Morale, with the unit's SP laid over them
         in the colour of the band it has reached. */
      var cap = 3 * Math.max(1, m), fillC = st === 'broken' ? 'bad' : st === 'suppressed' ? 'warn' : 'good';
      h += '<div class="moralebar" title="Steady · Suppressed · Broken — ' + u.sp + ' SP against Morale ' + m + '">' +
        '<div class="mb-track"><span class="mb-band good"></span><span class="mb-band warn"></span><span class="mb-band bad"></span>' +
        '<span class="mb-fill ' + fillC + '" style="width:' + Math.min(100, (u.sp / cap) * 100) + '%"></span></div>' +
        // at 12 SP, the most a unit can carry: it cannot be suppressed any further
        (u.sp >= R.SP_MAX ? '<b class="mb-max" title="' + R.SP_MAX + ' SP — the most Suppression a unit can carry">!</b>' : '') + '</div>';
      h += '<div class="stats">' +
        stat('Models', u.models + '/' + u.size) + stat('Move', Math.floor(u.move) + '"') +
        stat('FP', u.fp === null ? '—' : u.fp) + stat('Range', u.range + '"') +
        stat('Def', u.def + (R.has(u, 'Battle Armour') ? '/' + (u.def - 2) : '')) +
        stat('Assault', u.assault) +
        /* Morale as it stands: less a point for each model lost beyond the free
           ones (none for a Determined unit — currentMorale has already said so) */
        stat('Morale', m + (m !== u.morale ? '<i class="mmod" ' + tip('Morale ' + u.morale + ' printed',
          (u.morale - m) + ' down for casualties') + '>(' + (m - u.morale) + ')</i>' : '')) +
        // its Suppression, in the colour of the band it has reached on the bar
        '<div class="st"><span>SP</span><b class="sp-' + fillC + '">' + u.sp + '</b></div>' + '</div>';
      h += honourChips(u);
      // a rider's mount, before its rules, the way a hull's drive is shown
      var mt = R.mountOf(u);
      h += ruleChips(u, R.terrainOf(B.state, u) !== 'open', mt && mt !== R.MOUNTS.none ? [{ name: mt.name, text: mt.note }] : null);
      fillStats(box, h);
    }
    /* The stats are redrawn with every render, and in a demo that is every
       action: rewriting them unchanged would pull a tapped chip out from under
       its open tip (it loses focus, and the tip goes). So only a change is written. */
    function fillStats(box, h) {
      if (box._html === h) return;
      box._html = h;
      box.innerHTML = h;
      wireHost(box);
    }
    // what the army list calls the unit's kind — Combat vehicles, Assault troops
    function groupOf(u) {
      var g = u.group || (R.profile(u.key) || {}).group;
      return g ? ' · ' + esc(g) : '';
    }
    // the army's own colours on the unit tab's code badge, as its ring is painted on the table
    function armyStyle(side) {
      var pal = ISO.PALETTE && ISO.PALETTE[side];
      if (!pal) return '';
      return ' style="color:' + pal.light + ';border-color:' + pal.mid + ';background:color-mix(in srgb, ' + pal.dark + ' 45%, transparent)"';
    }
    function stat(k, v) { return '<div class="st"><span>' + k + '</span><b>' + v + '</b></div>'; }

    /* What a campaign unit is carrying into the fight, at a glance: a star for every
       Battle Honour it has earned (p. 88), a heart for every Battle Trauma it is
       living with (p. 90), and a spanner for a vehicle Upgrade. Hover or tap for
       the names. A one-off battle shows nothing, because nobody has a history. */
    /* The stars beside a name, and behind each one the rules they stand for —
       a name like "Rain of Fire" means nothing until you have read the sentence,
       so the tip carries the sentence, not just the name. */
    function spellOut(list, table) {
      return list.map(function (n) {
        var x = table[n - 1];
        return x ? x.name + ' — ' + x.text : '?';
      }).join('\n');
    }
    function honourMarks(u) {
      var c = u && u.camp;
      if (!c) return '';
      var hon = c.honours || [], tra = c.traumas || [], up = c.upgrades || [];
      if (!hon.length && !tra.length && !up.length) return '';
      var bug = u.faction === 'bugs';
      var h = '<span class="marks">';
      if (hon.length) {
        h += '<span class="mark-hon" ' + tip(
          hon.length === 1 ? (bug ? 'Adaptation' : 'Battle Honour') : hon.length + (bug ? ' Adaptations' : ' Battle Honours'),
          spellOut(hon, C.honourTable(u.key))) + '>' + new Array(hon.length + 1).join('★') + '</span>';
      }
      if (tra.length) {
        h += '<span class="mark-tra" ' + tip(
          tra.length === 1 ? (bug ? 'Genetic Flaw' : 'Battle Trauma') : tra.length + (bug ? ' Genetic Flaws' : ' Battle Traumas'),
          spellOut(tra, C.traumaTable(u.key))) + '>' + new Array(tra.length + 1).join('♥') + '</span>';
      }
      if (up.length) {
        h += '<span class="mark-up" ' + tip(
          up.length === 1 ? 'Upgrade' : up.length + ' upgrades',
          spellOut(up, C.UPGRADES)) + '>' + new Array(up.length + 1).join('⚙') + '</span>';
      }
      return h + '</span>';
    }
    /* The names behind the marks, spelled out under the stats. */
    function honourChips(u) {
      var c = u && u.camp;
      if (!c) return '';
      var out = [];
      (c.honours || []).forEach(function (n) {
        var x = C.honourTable(u.key)[n - 1];
        if (x) out.push('<span class="chip chip-hon" ' + tip(x.name, x.text) + '>★ ' + esc(x.name) + '</span>');
      });
      (c.traumas || []).forEach(function (n) {
        var x = C.traumaTable(u.key)[n - 1];
        if (x) out.push('<span class="chip chip-tra" ' + tip(x.name, x.text) + '>♥ ' + esc(x.name) + '</span>');
      });
      (c.upgrades || []).forEach(function (n) {
        var x = C.UPGRADES[n - 1];
        if (x) out.push('<span class="chip chip-up" ' + tip(x.name, x.text) + '>⚙ ' + esc(x.name) + '</span>');
      });
      return out.length ? '<div class="chips">' + out.join('') + '</div>' : '';
    }
    function esc(t) { return R.esc(t); }   // the shared one, in the rules
    // the tooltip attributes, from tips.js; a page without it falls back to `title`
    function tip(head, body) {
      return window.PMCTips ? window.PMCTips.attr(head, body)
        : 'title="' + esc((head ? head + ' — ' : '') + body) + '"';
    }

    // a machine has Structure and Damage where a squad has Morale and suppression
    function drawMachineStats(u, box) {
      var left = Math.max(0, u.str - u.damage);
      var pr = R.propOf(u);
      var h = '<div class="stat-head"><span class="code code-' + u.side + '"' + armyStyle(u.side) + '>' + u.code + '</span>' +
        '<div class="sh-text"><h2>' + u.name + honourMarks(u) + '</h2><span class="sub">Tier ' + u.tier + groupOf(u) + '</span></div>' +
        '</div>';
      // its health: the Structure it has left — green untouched, amber down to half, red below
      var frac = left / Math.max(1, u.str), hc = frac >= 1 ? 'good' : frac >= 0.5 ? 'warn' : 'bad';
      h += '<div class="moralebar healthbar" title="' + left + ' of ' + u.str + ' Structure left">' +
        '<div class="mb-track"><span class="mb-fill ' + hc + '" style="width:' + Math.round(frac * 100) + '%"></span></div></div>';
      /* What its drive (and a drone's missing crew) did to the printed profile:
         a changed stat shows its new value, green if it went up and red if it
         went down, with a tip saying what it was and why. */
      var base = R.profile(u.key) || {};
      function why(stat) {
        var out = [];
        if (pr && pr[stat]) out.push(pr.name + ' — ' + pr.note);
        if (stat === 'str' && u.drone) out.push('Drone Control — +1 Structure, no crew');
        return out.join('\n');
      }
      function changed(text, now, was, stat) {
        if (was == null || now === was) return text;
        return '<i class="schg ' + (now > was ? 'up' : 'dn') + '"' + (why(stat) ? ' ' + tip('Printed ' + was, why(stat)) : '') + '>' + text + '</i>';
      }
      h += '<div class="stats">' +
        // red once it is down below half its Structure; what the drive did to it is in its tip
        '<div class="st"><span>Structure</span><b' + (left * 2 < u.str ? ' class="hurt"' : '') +
          (base.str != null && base.str !== u.str && why('str') ? ' ' + tip('Printed ' + base.str, why('str')) : '') + '>' + left + '/' + u.str + '</b></div>' +
        // a half inch of Movement is kept, but shown rounded down
        stat('Move', changed(Math.floor(u.move) + '"', u.move, base.move, 'move') + (u.turn ? ' (' + u.turn + ')' : '')) +
        stat('FP', u.fp === null ? '—' : u.fp) + stat('Range', u.range + '"') +
        stat('Def', changed(String(u.def), u.def, base.def, 'def')) + stat('Assault', u.cls === 'aircraft' ? '—' : u.assault) +   // aircraft have none (a '–' in the book)
        stat('Damage', u.damage) + '</div>';
      if ((u.cargo || []).length) {
        h += '<div class="chips">' + u.cargo.map(function (c) {
          return '<span class="chip">aboard: ' + c.name + '</span>';
        }).join('') + '</div>';
      }
      h += honourChips(u);                                // a campaign machine's honours, traumas and upgrades
      h += ruleChips(u, !!terrainMark(u), pr && pr.key !== 'none' ? [{ name: pr.name, text: pr.note }] : null);
      fillStats(box, h);
    }
    /* The special rules, each with its rule text to tap or hover for, and first
       among them the ground the unit stands on — marked as the map marks it, and
       left out in the open, where there is nothing to say. */
    function ruleChips(u, showGround, extra) {
      var out = [];
      (extra || []).forEach(function (x) {                // a vehicle's drive, before its rules
        out.push('<span class="chip chip-drive" ' + tip(x.name, x.text) + '>' + esc(x.name) + '</span>');
      });
      if (showGround) {
        var tk = R.terrainOf(B.state, u), mk = TERRAIN_MARK[tk], bits = terrainBits(tk, !!u.bld);
        out.push('<span class="chip tpill" ' + tip(R.TERRAIN[tk].name, bits.length ? bits.join(' · ') : 'no cover, no penalty') + '>' +
          (mk ? '<i style="background:' + mk.col + '">' + mk.ch + '</i>' : '') + esc(R.TERRAIN[tk].name) + '</span>');
      }
      var TXT = window.PMCRuleText;
      (u.rules || []).forEach(function (r) {
        var d = TXT ? TXT.describe(r) : { text: '' };
        out.push('<span class="chip"' + (d.text ? ' ' + tip(r, d.text) : '') + '>' + esc(r) + '</span>');
      });
      return out.length ? '<div class="chips">' + out.join('') + '</div>' : '';
    }

    /* ---------- side panel ---------- */
    // What you act with lives under the board; the roster and log live in the panel
    // (a slide-out drawer on a narrow screen).
    function drawPanel() {
      var ctxBox = el('context'), html = '';
      if (B.state.phase !== 'deploy') deployBox = false;   // it belongs to the deployment, and goes with it
      if (B.state.phase === 'terrain') html = terrainCard();
      else if (B.state.placeAsk && !isAI(B.state.placeAsk.side)) html = placeCard();
      else if (B.state.minePick && !isAI(B.state.minePick.side)) html = mineCard();
      else if (B.state.phase === 'deploy') html = deployCard();
      else if (ui.reservePick) html = reservePickCard();
      else if (ui.insertion) html = insertionCard();
      else if (B.state.cmdOffer) html = cmdOfferCard();
      else if (B.state.martyrAsk && !isAI(B.state.martyrAsk.side)) html = martyrCard();
      else if (B.state.kyfAsk && !isAI(B.state.kyfAsk.side)) html = kyfCard();
      else if (B.state.over) html = overCard();
      else if (ui.terrain.length && ui.selected &&
        (ui.mode === 'breach' || ui.mode === 'demolish')) html = terrainPanel(ui.selected);
      else if (ui.mode === 'enter' && ui.sections.length && ui.selected) html = sectionPanel(ui.selected);
      else if (ui.mode === 'digface' && ui.selected && !isAI(ui.selected.side)) html = digFaceCard(ui.selected);
      else if (ui.preview) html = movePreviewCard();
      else if (ui.targets.length && ui.selected && ['fire', 'aux', 'advance-fire', 'assault', 'designate'].indexOf(ui.mode) >= 0) {
        html = targetPanel(ui.selected);
      }
      else if (ui.selected && !isAI(ui.selected.side)) html = idleCard(ui.selected);
      // a modal open over the card keeps its place when the card is drawn again
      var ms = ctxBox.querySelector('.cmodal:not([hidden]) .cmodal-scroll'), mTop = ms ? ms.scrollTop : 0;
      ctxBox.innerHTML = html;
      var ms2 = ctxBox.querySelector('.cmodal:not([hidden]) .cmodal-scroll');
      if (ms2 && ms) ms2.scrollTop = mTop;
      el('panel').innerHTML = forceList();
      /* The desktop rails: your own order of battle on the left, the enemy's on
         the right. They are the same list, split. */
      var me = playerSide() || 'A', foe = me === 'A' ? 'B' : 'A';
      var own = el('panel-own'), opp = el('panel-foe'), both = el('panel-m');
      if (own) own.innerHTML = forceList(me);
      if (opp) opp.innerHTML = forceList(foe);
      if (both) both.innerHTML = forceList();
      var con = document.querySelector('.console');
      if (con) con.classList.toggle('deploying', B.state.phase === 'deploy' || B.state.phase === 'terrain');
      wirePanel();
      /* The army swap wants the whole screen: its modal is lifted out of the card
         (which the board would draw over on a desktop) onto the page itself. */
      var mh = el('modal-host');
      if (!mh) { mh = document.createElement('div'); mh.id = 'modal-host'; document.body.appendChild(mh); }
      var sw = ctxBox.querySelector('.cmodal[data-swapbox]');
      var swScroll = mh.querySelector('.cmodal-scroll'), swTop = swScroll ? swScroll.scrollTop : 0;
      // the next player's list opens at the top, not where the last one was scrolled to
      var swWho = B.state.swapAsk ? B.state.swapAsk.side : '';
      if (mh.dataset.swapWho !== swWho) { swTop = 0; mh.dataset.swapWho = swWho; }
      mh.innerHTML = '';
      if (sw) {
        mh.appendChild(sw);
        var sw2 = mh.querySelector('.cmodal-scroll'); if (sw2) sw2.scrollTop = swTop;   // wired where it was drawn
      }
      /* ...and so does the reserves-and-transports modal: in the side rail it was
         drawn under the board, so opening it seemed to do nothing. It is already
         wired where it was drawn, so it is only moved. */
      var db = ctxBox.querySelector('.cmodal[data-deploybox]');
      if (db) mh.appendChild(db);
      if (own) wireHost(own);
      if (opp) wireHost(opp);
      if (both) wireHost(both);
    }

    function forceList(only) {
      var h = '<div class="forces">';
      /* A co-op game's commandos are one side, but each player's is listed on its
         own, under its name and in its colour. */
      var groups = [];
      (only ? [only] : ['A', 'B']).forEach(function (side) {
        if (side === 'A' && B.state.solo && B.state.solo.coop) {
          B.state.solo.owners.forEach(function (o) { groups.push({ side: side, owner: o, name: soloOwnerName(o) }); });
        } else groups.push({ side: side, owner: null, name: side === 'A' ? B.state.cfg.nameA : B.state.cfg.nameB });
      });
      groups.forEach(function (gp) {
        var side = gp.side;
        h += '<div class="force force-' + side + (gp.owner ? ' force-own' + gp.owner : '') + '"><h3>' + esc(gp.name) +
          ' <span class="tag">' + (gp.owner ? 'P' + gp.owner : side) + '</span></h3><ul>';
        // the living in their order, and whatever is gone below them
        // each as it stands on the table: a unit still to be hit in what is being drawn is shown as it was
        var mine = B.state.units.filter(function (u) { return u.side === side && (!gp.owner || (u.owner || 1) === gp.owner); }).map(shownAs);
        mine.filter(function (u) { return u.alive; }).concat(mine.filter(function (u) { return !u.alive; })).forEach(function (u) {
          var st = u.alive ? R.status(u) : 'dead';
          var gone = u.alive ? '' : u.fled ? 'fled' : R.isMachine(u) ? 'destroyed' : 'wiped out';
          h += '<li class="ru ' + st + (u.activated && u.alive ? ' done' : '') + (ui.selected && ui.selected.id === u.id ? ' sel' : '') +
            '" data-unit="' + u.id + '"><span class="ru-code">' + u.code + '</span>' +
            '<span class="ru-name">' + u.name + honourMarks(u) +
            '</span>' +
            (gone ? '<span class="ru-gone">' + gone + '</span>' :
            '<span class="ru-num">' + (R.isMachine(u)
              ? Math.max(0, u.str - u.damage) + '/' + u.str
              : u.models + '/' + u.size) + '</span>' +
            '<span class="ru-sp">' + (u.safe ? 'safe' : u.reserve && u.wave === 'pool' ? (B.state.sc.counters ? 'hidden' : 'pool') : u.reserve ? 'reserve' : u.aboard ? 'aboard'
              : R.isMachine(u) ? u.damage + ' DP' : u.sp + ' SP') + '</span>') + '</li>';
        });
        h += '</ul></div>';
      });
      return h + '</div>';
    }

    /* the odds of the pending shot or charge against one target, or null when the
       mode is not an attack */
    function oddsOn(t) {
      var u = ui.selected;
      if (!u) return null;
      if (ui.mode === 'assault') return R.assaultOdds(B.state, u, t);
      if (['fire', 'aux', 'advance-fire'].indexOf(ui.mode) < 0) return null;
      return R.shotOdds(B.state, u, t, ui.mode === 'aux' ? 'fire' : ui.mode,
        { aux: ui.mode === 'aux' });
    }

    function drawOdds(t, odds) {
      var pct = Math.round(odds.chance * 100) + '%';
      var avg = odds.avgHits.toFixed(1) + (odds.avgHits === 1 ? ' hit' : ' hits');
      var head = ISO.headroom(t.models, R.status(t), t);
      var p = hud(t.x, t.y, liftOf(t.x, t.y) + head + ISO.K * 1.15);
      var warm = ui.mode === 'assault' ? '#e4693f' : '#e8c15a';
      B.ctx.save();
      B.ctx.textBaseline = 'middle';
      B.ctx.font = '700 13px Oxanium, system-ui, sans-serif';
      var wPct = B.ctx.measureText(pct).width;
      B.ctx.font = '500 10px IBM Plex Mono, ui-monospace, monospace';
      var wAvg = B.ctx.measureText(avg).width;
      var w = wPct + wAvg + 18, x0 = p.x - w / 2;
      B.ctx.fillStyle = 'rgba(8,11,16,.88)';
      roundRect(B.ctx, x0, p.y - 10, w, 20, 4);
      B.ctx.fill();
      B.ctx.strokeStyle = warm; B.ctx.lineWidth = 1; B.ctx.stroke();
      B.ctx.textAlign = 'left';
      B.ctx.font = '700 13px Oxanium, system-ui, sans-serif';
      B.ctx.fillStyle = odds.chance >= .7 ? '#7ed6a0' : odds.chance >= .4 ? '#e8c15a' : '#e0557a';
      B.ctx.fillText(pct, x0 + 6, p.y + 1);
      B.ctx.font = '500 10px IBM Plex Mono, ui-monospace, monospace';
      B.ctx.fillStyle = 'rgba(231,236,244,.62)';
      B.ctx.fillText(avg, x0 + 6 + wPct + 6, p.y + 1);
      B.ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function sectionPanel(u) {
      var h = '<div class="targets"><h4>' + (u.bld ? 'Move into which section?' : 'Go into which building?') + '</h4>';
      ui.sections.forEach(function (q, n) {
        var t = R.TERRAIN[q.piece.kind], high = R.sectionHigh(q.piece, q.rect);
        var d = Math.max(0, R.rectPointDist(q.rect, u.x, u.y) - UR);
        h += '<button class="tgt" data-act="entersec" data-alt="' + n + '"><b>' + t.name +
          (q.piece.kind === 'building' ? (high ? ' — high' : ' — low') : '') + '</b><span>' +
          (u.bld ? 'next section' : d.toFixed(1) + '" away') + ' · +2 Defence' + (high ? ' · +2 Firepower' : '') + ' · no Crossfire</span></button>';
      });
      return h + '</div>';
    }
    function targetPanel(u) {
      var heads = {
        assault: 'Charge which unit?', designate: 'Designate which unit?',
        hack: 'Hack which drone?', support: 'Supporting Fire on which unit?',
        embark: 'Load which unit?', 'advance-fire': 'Advance — fire on which unit?'
      };
      var h = '<div class="targets"><h4>' + (heads[ui.mode] || 'Fire on which unit?') + '</h4>';
      ui.targets.forEach(function (t) {
        var d = R.unitDist(u, t).toFixed(1), extra = '';
        if (ui.mode === 'assault') {
          var ao = R.assaultOdds(B.state, u, t);
          extra = 'Assault +' + ao.mods + ' vs Def ' + ao.def + ' · hits on ' + ao.need + '+ · ' +
            Math.round(ao.chance * 100) + '% a round';
        } else if (ui.mode !== 'designate') {
          var aux = ui.mode === 'aux';
          // the Advance's shot is odds for an Advance: no bonus for standing still
          var oddsMode = ui.mode === 'aux' ? 'fire' : ui.mode === 'advance-fire' ? 'advance' : ui.mode;
          var o = R.shotOdds(B.state, u, t, oddsMode, { aux: aux });
          extra = '+' + o.mods + ' vs Def ' + o.def + ' · hits on ' + o.need + '+ · ' +
            Math.round(o.chance * 100) + '% · ' + o.avgHits.toFixed(1) + ' hits';
        }
        h += '<button class="tgt" data-target="' + t.id + '"><b>' + t.name + '</b><span>' + d + '" · ' + t.models + ' models · ' + extra + '</span></button>';
      });
      // having moved, an Advance may still decline its shot — and that ends the activation
      if (ui.mode === 'advance-fire') {
        h += '<div class="acts"><button class="act" data-act="holdfire"><span>Hold its fire</span><small>Ends the activation</small></button></div>';
      }
      return h + '</div>';
    }

    /* With a unit picked and no action chosen yet, the card says what each of the
       buttons would do — and, for the ones that are out, why. A phone has no
       tooltips, and a greyed-out button that will not say why is the commonest
       thing to be stuck on. */
    function idleCard(u) {
      var all = STANDARD.concat(specialsFor(u));
      var live = [], out = [];
      all.forEach(function (a) {
        var st = actionState(u, a.id);
        (st.on ? live : out).push({ label: a.label, hint: st.hint });
      });
      var h = '<div class="card idle"><h2>' + esc(u.name) +
        (R.status(u) !== 'ready' ? ' <span class="role role-defender">' + R.status(u) + '</span>' : '') +
        '</h2>';
      if (!live.length) {
        h += '<p class="sub">Nothing it can do this activation.</p>';
      } else {
        h += '<ul class="idlelist">' + live.map(function (a) {
          return '<li><b>' + esc(a.label) + '</b><span>' + esc(a.hint) + '</span></li>';
        }).join('') + '</ul>';
      }
      if (out.length) {
        h += '<ul class="idlelist out">' + out.slice(0, 4).map(function (a) {
          return '<li><b>' + esc(a.label) + '</b><span>' + esc(a.hint) + '</span></li>';
        }).join('') + '</ul>';
      }
      return h + '</div>';
    }

    /* Demolition picks a piece of the table rather than a unit, and hunting for a
       dashed outline on a zoomed-out board is not a fair ask — so the pieces in
       reach are listed as buttons too, the nearest first. */
    function terrainPanel(u) {
      var breach = ui.mode === 'breach';
      var sap = R.has(u, 'Sappers');
      var h = '<div class="targets"><h4>' +
        (breach
          ? (sap ? 'Set charges on what?' : 'Demolish which objective?')
          : 'Bring down which structure?') + '</h4>' +
        '<p class="sub">' + (breach
          ? 'A charge is an Assault: ' + esc(u.name) + ' walks up to it, rolls Assault ' +
          (sap ? '+4 (Sappers)' : '+2') + ', and needs a final 15+ or an unmodified 9. ' +
          'A failure falls back 2". Tap one below, or the outlined piece on the table.'
          : 'Shooting a structure down needs a Destructive Weapon: a final 15+, or an unmodified 9. ' +
          'Tap one below, or the outlined piece on the table.') + '</p>';
      var mid = function (r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
      ui.terrain.slice().sort(function (a, b2) {
        return R.inches(u.x, u.y, mid(a).x, mid(a).y) - R.inches(u.x, u.y, mid(b2).x, mid(b2).y);
      }).forEach(function (r) {
        var m = mid(r), d = R.inches(u.x, u.y, m.x, m.y);
        var what = r.objective ? 'The objective' : (R.TERRAIN[r.kind] ? r.kind : 'structure');
        var i = B.state.terrain.indexOf(r);
        h += '<button class="tgt" data-piece="' + i + '"><b>' +
          esc(what.charAt(0).toUpperCase() + what.slice(1)) + '</b><span>' +
          d.toFixed(1) + '" away · ' + Math.round(r.w) + '"×' + Math.round(r.h) + '"' +
          (r.objective ? ' · this is what the scenario is fought over' : '') +
          '</span></button>';
      });
      return h + '</div>';
    }

    /* The order of battle, as a list the player can pick from: anything still in
       hand can be set down next, and anything already down can be picked up and
       shifted, until he calls the deployment finished. */
    function deployList(side) {
      var roster = deployRoster(side);
      if (!roster.length) return '';
      var next = deployNext();
      var rows = roster.map(function (u) {
        var down = u.x >= 0;
        var cls = 'dpr' + (next && u.id === next.id ? ' dpr-now' : '') + (down ? ' dpr-set' : '');
        return '<button class="' + cls + '" data-deploy="' + u.id + '">' +
          '<span class="dpr-mark">' + (down ? '✓' : '·') + '</span>' +
          '<span class="dpr-name">' + esc(u.name) + '</span>' +
          '<span class="dpr-note">' + (down ? 'on the table — tap to shift' : 'in hand') + '</span>' +
          '</button>';
      }).join('');
      var left = roster.filter(function (u) { return u.x < 0; }).length;
      return '<div class="dplist"><div class="dphead">Order of battle — ' +
        (left ? left + ' still to place' : 'all set down') +
        '</div>' + rows + '</div>';
    }

    function relocCard() {
      var rl = B.state.relocating, me = rl.side;
      var pick = ui.deployPick ? byId(ui.deployPick) : null;
      var rows = B.state.units.filter(function (u) { return u.side === me && u.alive && u.x >= 0 && !u.aboard; }).map(function (u) {
        var moved = rl.moved.indexOf(u.id) >= 0;
        return '<button class="dpr' + (pick && pick.id === u.id ? ' dpr-now' : '') + (moved ? ' dpr-set' : '') + '" data-deploy="' + u.id + '">' +
          '<span class="dpr-mark">' + (moved ? '✓' : '·') + '</span><span class="dpr-name">' + esc(u.name) + '</span>' +
          '<span class="dpr-note">' + (moved ? 'relocated' : 'tap to move') + '</span></button>';
      }).join('');
      return '<div class="card"><h2>Rapid Relocation</h2>' +
        '<p class="sub">Everyone is down. You may pick up to <b>' + rl.cap + '</b> of your units and set them down again anywhere your deployment allows. No unit moves twice.</p>' +
        '<p class="hint">' + rl.moved.length + ' of ' + rl.cap + ' moved' + (pick ? ' — tap the table where <b>' + esc(pick.name) + '</b> should go' : '') + '.</p>' +
        '<div class="dplist"><div class="dphead">Your units</div>' + rows + '</div>' +
        '<div class="acts"><button class="act primary" data-act="start"><span>Begin the battle</span><small>Roll for initiative</small></button></div></div>';
    }

    function deployCard() {
      if (B.state.relocating) return relocCard();
      var next = deployNext();
      // the units coming in by Battlefield Insertion — not the ones the scenario holds back
      var held = inReserve().filter(function (u) { return !isAI(u.side) && u.wave == null; });
      var me = next ? next.side : (playerSide() || 'A');
      var role = roleOf(me);
      var h = '<div class="card"><h2>' + (B.state.scen ? B.state.scen.name : 'Deployment') +
        (role ? ' <span class="role role-' + role + '">You ' +
          (role === 'attacker' ? 'attack' : 'defend') + '</span>' : '') + '</h2>' +
        (role ? '<p class="sub"><b>' + roleSentence() + '</b></p>' : '') +
        '<p class="sub">' + (B.state.scen ? B.state.scen.hint : '') + '</p>' +
        '<p class="sub">' + deployWhere(me) +
        (held.length ? ' <b>' + held.map(function (u) { return u.name; }).join(', ') +
          '</b> stay in reserve and come in by Battlefield Insertion from the second turn on.' : '') + '</p>';
      if (next) h += '<p class="hint"><b>' + esc(next.name) + '</b> · ' + next.models + ' models · Move ' + next.move + '" · FP ' + next.fp + ' · Range ' + next.range + '" · Def ' + next.def +
        (next.x >= 0 ? ' — already down; tap the table to shift it' : '') + '</p>';
      // Modifying the armies (p. 46): offered until the first unit goes down
      if (!isAI(me) && B.Q.canSwapNow(me)) {
        var sv = B.state.swapAvail[me];
        h += '<div class="acts"><button class="act" data-act="swapopen"><span>Modify your army</span><small>Swap up to ' + sv.left +
          ' unit' + (sv.left === 1 ? '' : 's') + ' for others of the same Tier, having seen the table and their force</small></button></div>';
      }
      h += deployList(me);
      /* The scenario's split (which units go on the table and which wait, or
         which wave each comes in) and who starts the battle aboard a hull are
         set in a modal, opened from a button, whenever there is either. */
      var splits = ['A', 'B'].filter(function (sd) { return (sd === me || !deployRoster(sd).length) && splitFor(sd); });
      var hulls = carriersFor(me).filter(function (u) { return !isAI(u.side); });
      var extra = splits.map(splitCard).join('') + loadingCard(me);
      if (extra) {
        var what = splits.length && hulls.length ? 'Reserves and transports' : splits.length ? 'Reserves' : 'Transports';
        var badSplit = splits.some(function (sd) { return !splitFor(sd).ok; }), emptyPod = emptyPlatforms(me).length > 0;
        var aboard = hulls.reduce(function (n, v) { return n + (v.cargo || []).length; }, 0);
        var held = splits.reduce(function (n, sd) { return n + splitFor(sd).held; }, 0);
        var sub = [splits.length ? held + (splitFor(splits[0]).kind === 'wave' ? ' in the second wave' : ' held back') : '',
          hulls.length ? aboard + ' aboard' : ''].filter(Boolean).join(' \u00b7 ');
        h += '<div class="acts"><button class="act' + (badSplit || emptyPod ? ' warn' : '') + '" data-act="deploybox"><span>' + what + '</span>' +
          '<small>' + (badSplit ? 'The split is not legal yet \u2014 ' : emptyPod ? 'A drop pod needs a squad \u2014 ' : '') + sub + '</small></button></div>';
        h += '<div class="cmodal" data-deploybox' + (deployBox ? '' : ' hidden') + '><div class="cmodal-box" role="dialog" aria-modal="true" aria-label="' + what + '">' +
          '<h3>' + what + '</h3><div class="cmodal-scroll">' + extra + '</div>' +
          '<div class="askrow"><button class="start" data-act="deployboxdone">Done</button></div></div></div>';
      }
      else {
        // no hull to fill and no split to set: the button is there, greyed out, so it is known to exist
        h += '<div class="acts"><button class="act" disabled title="Nothing in this force can carry troops"><span>Transports</span><small>No transports in this force</small></button></div>';
      }
      if (B.state.swapAsk && !isAI(B.state.swapAsk.side) && (B.state.swapAsk.side === me || B.state.swapStage)) h += swapCard();
      // the way on stays at the foot of the card, however long the order of battle above it
      h += '<div class="acts deploy-go"><button class="act" data-act="autodeploy"><span>Auto-deploy the rest</span></button>';
      if (deploymentDone()) h += '<button class="act primary" data-act="start"><span>Begin the battle</span><small>Roll for initiative</small></button>';
      else if (emptyPlatforms(me).length) {
        h += '<p class="cpwarn">A Rapid insertion platform has to start the battle with a squad aboard. Put one in, or the battle cannot begin.</p>';
      }
      return h + '</div></div>';
    }

    /* The split the scenario made, for the player to change: a row for each unit,
       tapped to move it between the table and the reserve (or between the waves),
       and a count against what the rule allows. */
    var deployBox = false;           // the reserves-and-transports modal, open over the deployment card
    function splitCard(side) {
      var sp = splitFor(side);
      if (!sp) return '';
      var wave = sp.kind === 'wave';
      var both = !isAI('A') && !isAI('B') && !(B.state.solo);
      var range = sp.min === sp.max ? String(sp.min) : sp.min + '\u2013' + sp.max;
      var rows = sp.units.map(function (x) {
        var note = x.locked ? 'emplaced \u2014 never held back'
          : wave ? (x.held ? 'second wave' : 'first wave')
          : x.held ? 'held back' : 'on the table';
        return '<button class="dpr' + (x.held ? ' dpr-held' : ' dpr-set') + '" data-holdback="' + x.id + '"' + (x.locked ? ' disabled' : '') + '>' +
          '<span class="dpr-mark">' + (x.held ? (wave ? '2' : '\u21a9') : (wave ? '1' : '\u2713')) + '</span>' +
          '<span class="dpr-name">' + esc(x.name) + '</span>' +
          '<span class="dpr-note">' + note + '</span></button>';
      }).join('');
      return '<div class="dplist splitlist"><div class="dphead">' + (both ? esc(sideName(side)) + ' \u2014 ' : '') +
        (wave ? 'The two waves' : 'Held back') + ' \u2014 ' +
        '<b class="' + (sp.ok ? 'ok' : 'short') + '">' + sp.held + '</b> of ' + range + (wave ? ' in the second wave' : ' to hold back') + '</div>' +
        '<p class="hint small">' + esc(sp.rule) + ' Tap a unit to ' + (wave ? 'switch its wave' : 'hold it back or bring it onto the table') + '.</p>' +
        rows +
        (sp.ok ? '' : '<p class="cpwarn">' + (wave ? 'Put ' : 'Hold back ') + (sp.held < sp.min ? (sp.min === sp.max ? 'exactly ' + sp.min : 'at least ' + sp.min) : (sp.min === sp.max ? 'exactly ' + sp.max : 'no more than ' + sp.max)) +
          (wave ? ' in the second wave' : '') + ' before the battle can begin.</p>') +
        '</div>';
    }

    // which of the reserves come on this turn, where the scenario lets the player choose
    /* Dig in!: the eight facings as an octagon of buttons, laid out as they
       point on the screen, the one on offer marked; hovering one shows its fire
       arc on the table, pressing it digs the gun in that way. */
    function digFaceCard(u) {
      var F = digFacings(), pick = digPreview(u);
      var grid = [[5, 6, 7], [4, -1, 0], [3, 2, 1]];     // NW N NE / W · E / SW S SE
      var cells = grid.map(function (row) {
        return row.map(function (i) {
          if (i < 0) return '<span class="dig-mid">' + esc(u.code || '') + '</span>';
          var on = Math.abs(R.angleWrap(F[i] - pick)) < 0.01;
          return '<button class="dig-dir' + (on ? ' on' : '') + '" data-digface="' + i + '">' + DIG_NAMES[i] + '</button>';
        }).join('');
      }).join('');
      return '<div class="card"><h2>Dig in! — which way?</h2>' +
        '<p class="sub">' + esc(u.name) + ' is laid over open sights and cannot be turned after: it fires only across the 90° in front, 6"–24". ' +
        'Tap a direction round the gun on the table, or here.</p>' +
        '<div class="dig-oct">' + cells + '</div>' +
        '<div class="acts"><button class="act" data-act="digcancel"><span>Cancel</span><small>Keep its normal stance</small></button></div></div>';
    }
    function reservePickCard() {
      var rp = ui.reservePick;
      var mine = !isAI(rp.side);
      var n = rp.chosen.length, ok = n >= rp.min && n <= rp.max;
      var rows = rp.ids.map(function (id) {
        var u = byId(id), on = rp.chosen.indexOf(id) >= 0;
        if (!u) return '';
        return '<button class="dpr' + (on ? ' dpr-now' : '') + '" data-rpick="' + id + '">' +
          '<span class="dpr-mark">' + (on ? '\u2713' : '\u00b7') + '</span>' +
          '<span class="dpr-name">' + esc(u.name) + '</span>' +
          '<span class="dpr-note">' + (on ? 'coming on' : 'stays in reserve') + '</span></button>';
      }).join('');
      var want = rp.min === rp.max ? rp.min : (rp.min ? rp.min + '\u2013' : 'up to ') + rp.max;
      return '<div class="card"><h2>Reserves</h2>' +
        '<p class="sub">' + esc(rp.text) + '</p>' +
        '<div class="dplist"><div class="dphead">' + n + ' of ' + want + ' chosen</div>' + rows + '</div>' +
        (mine ? '<div class="acts"><button class="act primary" data-act="rpickdone"' + (ok ? '' : ' disabled') + '>' +
          '<span>' + (n ? 'Bring them on' : 'Keep them all back') + '</span>' +
          '<small>' + (n ? 'Then choose where each one comes on' : 'They can come on in a later turn') + '</small></button></div>' : '') +
        '</div>';
    }

    function loadingCard(side) {
      var hulls = carriersFor(side).filter(function (u) { return !isAI(u.side); });
      if (!hulls.length) return '';
      var h = '<div class="loadbox"><h3>Aboard before the battle</h3>' +
        '<p class="hint small">Troops can start the game inside a hull, declared before a shot is fired. ' +
        'A Rapid insertion platform has to. A Lifter can start with a vehicle slung under it, and a hull with a gun on tow.</p>';
      hulls.forEach(function (v) {
        var cargo = v.cargo || [], room = v.transport - cargo.length;
        var must = R.has(v, 'Immobile');
        h += '<div class="loadrow' + (must && !cargo.length ? ' needs' : '') + '">' +
          '<div class="loadhead"><b>' + esc(v.name) + '</b>' +
          '<span class="mk">' + cargo.length + ' of ' + v.transport + (R.has(v, 'Lifter') ? ' slung' : ' aboard') + '</span>' +
          (must ? '<span class="mk warn">must carry a squad</span>' : '') + '</div>';
        if (cargo.length) {
          h += '<div class="loadlist">' + cargo.map(function (c) {
            return '<button class="lnk" data-unload="' + c.id + '" data-hull="' + v.id + '">' +
              esc(c.name) + ' ✕</button>';
          }).join('') + '</div>';
        }
        if (room > 0) {
          var can = boardableFor(v);
          h += can.length
            ? '<div class="loadlist">' + can.slice(0, 8).map(function (c) {
              return '<button class="lnk" data-load="' + c.id + '" data-hull="' + v.id + '">+ ' +
                esc(c.name) + '</button>';
            }).join('') + '</div>'
            : '<div class="hint small">' + (R.has(v, 'Lifter') ? 'No vehicle left to sling under it.' : (v.cargo || []).some(function (c) { return R.has(c, 'Stationary Artillery'); }) ? 'A gun on the hook: nothing else rides.' : 'No infantry left to put aboard.') + '</div>';
        }
        h += '</div>';
      });
      return h + '</div>';
    }

    function overCard() {
      return '<div class="card"><h2>' + (B.state.over.winner ? sideName(B.state.over.winner) + ' wins' : 'Draw') + '</h2>' +
        '<p class="sub">' + B.state.over.text + '</p>' + casualtyList() +
        '<div class="acts"><button class="act primary" data-act="restart"><span>Main menu</span></button></div></div>';
    }

    /* The casualty list, side by side: every soldier lost, by rank, name and
       the kind of unit they served in, with the turn it happened. */
    function casualtyList() {
      var list = (B.state.report && B.state.report.casualties) || null;
      if (!list) return '';
      return '<div class="cas">' + ['A', 'B'].map(function (side) {
        var all = list.filter(function (c) { return c.side === side; });
        var mine = all.filter(function (c) { return !c.swarm; });
        // the swarm has no names: its losses are biomass, totalled by kind of bug
        var bio = {}, bioOrder = [], bioTotal = 0;
        all.forEach(function (c) {
          if (!c.swarm) return;
          if (!bio[c.type]) { bio[c.type] = { n: 0, mass: 0 }; bioOrder.push(c.type); }
          var m = c.mass != null ? c.mass : c.count;
          bio[c.type].n += c.count; bio[c.type].mass += m; bioTotal += m;
        });
        var lostN = mine.reduce(function (n, c) { return n + (c.count || 1); }, 0);
        var head = bioOrder.length ? bioTotal + ' biomass lost'
          : lostN ? lostN + (lostN === 1 ? ' casualty' : ' casualties') : 'no casualties';
        var h = '<div class="cas-side cas-' + side + '"><div class="cas-head">' + esc(sideName(side)) +
          '<span class="mk">' + head + '</span></div>';
        if (bioOrder.length) {
          bioOrder.sort(function (a, b) { return bio[b].mass - bio[a].mass || bio[b].n - bio[a].n; });
          h += '<ol class="cas-list">' + bioOrder.map(function (t) {
            return '<li><b>' + esc(t) + '</b> <span class="cas-rank">\u00d7 ' + bio[t].n +
              (bio[t].mass ? ' \u00b7 ' + bio[t].mass + ' biomass' : ' \u00b7 not biomass') + '</span></li>';
          }).join('') + '</ol>';
        }
        if (mine.length) {
          h += '<ol class="cas-list">' + mine.map(function (c) {
            // the Esh-Aven go unnamed: how many of them, from which unit
            if (c.anon) {
              return '<li><b>' + esc(c.type) + '</b> <span class="cas-rank">\u00d7 ' + c.count + ' Esh-Aven</span>' +
                (c.unit && c.unit !== c.type ? '<span class="cas-type">' + esc(c.unit) + '</span>' : '') + '</li>';
            }
            return '<li><span class="cas-rank">' + esc(c.rank) + '</span> <b>' + esc(c.name) + '</b>' +
              '<span class="cas-type">' + esc(c.type) + (c.unit && c.unit !== c.type ? ' \u00b7 ' + esc(c.unit) : '') +
              ' \u00b7 turn ' + (c.turn || 1) + '</span></li>';
          }).join('') + '</ol>';
        }
        return h + '</div>';
      }).join('') + '</div>';
    }

    function wirePanel() {
      [el('context'), el('panel')].forEach(wireHost);
    }

    function wireHost(host) {
      if (!host) return;
      // a tap on the shade around the reserves-and-transports modal puts it away
      host.querySelectorAll('.cmodal[data-deploybox]').forEach(function (m) {
        m.addEventListener('click', function (ev) { if (ev.target === m) { deployBox = false; render(); } });
      });
      /* The load and unload buttons carry `data-load`/`data-unload` and no
         `data-act`, so selecting on `[data-act]` alone never bound them and
         nothing happened when they were pressed: troops could not be put aboard
         a hull, or taken off one, during deployment. All three are selected. */
      host.querySelectorAll('[data-digface]').forEach(function (b) {
        var i = +b.getAttribute('data-digface');
        b.addEventListener('click', function () { if (SFX) SFX.click(); ui.digHover = null; send({ k: 'digface', dir: digFacings()[i] }); });
        b.addEventListener('mouseenter', function () { ui.digHover = digFacings()[i]; drawBoard(); });
        b.addEventListener('mouseleave', function () { ui.digHover = null; drawBoard(); });
      });
      host.querySelectorAll('[data-act], [data-load], [data-unload], [data-holdback], [data-rpick], [data-swappick], [data-swapin]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-act');
          if (SFX) SFX.click();
          if (b.hasAttribute('data-swappick')) { send({ k: 'swappick', id: b.getAttribute('data-swappick') }); return; }
          if (b.hasAttribute('data-swapin')) { send({ k: 'swapin', id: b.getAttribute('data-swapin') }); return; }
          if (b.hasAttribute('data-holdback')) { send({ k: 'holdback', id: b.getAttribute('data-holdback') }); return; }
          if (b.hasAttribute('data-rpick')) { send({ k: 'rpick', id: b.getAttribute('data-rpick') }); return; }
          if (b.hasAttribute('data-load')) {
            var lv = byId(b.getAttribute('data-hull')), lu = byId(b.getAttribute('data-load'));
            loadBefore(lv, lu); render(); return;
          }
          if (b.hasAttribute('data-unload')) {
            var uv = byId(b.getAttribute('data-hull')), uu = byId(b.getAttribute('data-unload'));
            unloadBefore(uv, uu); render(); return;
          }
          if (!a) return;
          if (a === 'movego') { commitMove(); return; }
          else if (a === 'movecancel') { cancelPreview(); return; }
          else if (a === 'holdinsert') { holdInsertion(); return; }
          else if (a === 'holdfire') { send({ k: 'cancel' }); return; }
          else if (a === 'digcancel') { ui.digHover = null; send({ k: 'cancel' }); return; }
          else if (a === 'holdarrive') { holdArrival(); return; }
          else if (a === 'cmdcoord' || a === 'cmdskip') { send({ k: a }); return; }
          else if (a === 'nomine') { send({ k: 'mine', i: -1 }); return; }
          // whose list is being kept: in a hotseat's round of swaps the next player is up the moment it is
          else if (a === 'swapdone') { send({ k: a, who: b.getAttribute('data-who') }); return; }
          else if (a === 'placerot' || a === 'placedone') { send({ k: a }); return; }
          else if (a === 'swapback') { send({ k: 'swappick', id: null }); return; }
          else if (a === 'swapopen') { send({ k: 'swapopen' }); return; }
          else if (a === 'martyr' || a === 'nomartyr' || a === 'kyf' || a === 'nokyf') { send({ k: a }); return; }
          else if (a === 'entersec') { var sq = ui.sections[+b.getAttribute('data-alt')]; if (sq && ui.selected) doEnter(ui.selected, sq); }
          else if (a === 'talt' || a === 'tnext' || a === 'tauto' || a === 'tautoall' || a === 'trotate') terrainAct(a, b.getAttribute('data-alt'));
          else if (a === 'autodeploy') autoDeployMine();
          else if (a === 'rpickdone') send({ k: 'rpickdone' });
          else if (a === 'deploybox') { deployBox = true; render(); }
          else if (a === 'deployboxdone') { deployBox = false; render(); }
          else if (a === 'start') startBattle();
          else if (a === 'restart') openMenu();
        });
      });
      host.querySelectorAll('[data-piece]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = B.state.terrain[+b.getAttribute('data-piece')];
          if (!r || ui.terrain.indexOf(r) < 0) return;
          if (SFX) SFX.click();
          if (ui.mode === 'breach') doBreach(r); else doDemolish(r);
        });
      });
      host.querySelectorAll('[data-deploy]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (SFX) SFX.click();
          if (B.state.relocating) relocPick(b.getAttribute('data-deploy'));
          else pickToDeploy(b.getAttribute('data-deploy'));
        });
      });
      host.querySelectorAll('[data-target]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = B.state.units.filter(function (u) { return u.id === b.getAttribute('data-target'); })[0];
          if (!t) return;
          if (ui.mode === 'assault') doAssault(t);
          else if (ui.mode === 'designate') doDesignate(t);
          else if (ui.mode === 'hack') doHack(t);
          else if (ui.mode === 'steady') doSteady(t);
          else if (ui.mode === 'support') doSupport(t);
          else doShoot(t);
        });
      });
      host.querySelectorAll('[data-unit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = B.state.units.filter(function (x) { return x.id === b.getAttribute('data-unit'); })[0];
          if (u && u.alive) { closeDrawer(); select(u); }
        });
      });
    }

    function drawLog() {
      var html = B.state.log.map(function (l) {
        return '<div class="le le-' + l.t + '"><p>' + l.text + '</p>' + (l.math ? '<code>' + l.math + '</code>' : '') + '</div>';
      }).join('');
      ['log', 'log-dock'].forEach(function (id) {
        var host = el(id);
        if (!host) return;
        host.innerHTML = html;
        host.parentElement.scrollTop = host.parentElement.scrollHeight;
      });
      var n = el('logdock-n');
      if (n) n.textContent = B.state.log.length + ' entr' + (B.state.log.length === 1 ? 'y' : 'ies');
    }

    // On a narrow screen the action bar sits below the board. Bring it into view,
    // but never so far that the table itself is pushed off the top.
    function revealConsole() {
      if (window.innerWidth > 1000) return;
      var bar = el('bar'), ctxBox = el('context'), board = document.querySelector('.board-wrap');
      if (!bar || !board) return;
      var br = bar.getBoundingClientRect();
      if (br.height < 10 && ctxBox && ctxBox.firstChild) br = ctxBox.getBoundingClientRect();
      var bd = board.getBoundingClientRect();
      var vh = window.innerHeight;
      var need = br.bottom - (vh - 10);
      if (need <= 4) return;
      // scroll only as far as still leaves a good part of the table on screen
      var delta = Math.min(need, Math.max(0, bd.bottom - vh * 0.42));
      if (delta <= 4) return;
      try { window.scrollBy({ top: delta, behavior: 'smooth' }); }
      catch (e) { window.scrollBy(0, delta); }
    }


    /* The screen round the table, wired once at boot: the phone header's
       overflow menu and its tabs, the log dock, the results feed, the menu and
       objectives buttons, the multiplayer card (live only with a game server
       behind the page), the drawer, the notes, and the sound switch. */
    function wireChrome() {
      // the phone header's overflow menu
      var more = el('btn-more');
      if (more) {
        more.hidden = false;
        more.addEventListener('click', function () {
          var box = document.querySelector('.hdr-btns');
          if (box) box.classList.toggle('open');
          if (SFX) SFX.click();
        });
        document.addEventListener('click', function (e) {
          var box = document.querySelector('.hdr-btns');
          if (box && box.classList.contains('open') && !box.contains(e.target)) box.classList.remove('open');
        });
      }
      var mt = el('mtabs');
      if (mt) {
        mt.addEventListener('click', function (e) {
          var b = e.target.closest('[data-mtab]');
          if (!b) return;
          setMTab(b.getAttribute('data-mtab'));
          if (SFX) SFX.click();
        });
        setMTab('act');
      }
      // the log dock: shut by default, and it remembers if you open it
      var dock = el('logdock'), dockBtn = el('btn-logdock');
      if (dock && dockBtn) {
        try { if (localStorage.getItem('pmc-logdock') === '1') dock.classList.add('open'); } catch (e4) { }
        dockBtn.setAttribute('aria-expanded', dock.classList.contains('open') ? 'true' : 'false');
        dockBtn.addEventListener('click', function () {
          var open = dock.classList.toggle('open');
          dockBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          try { localStorage.setItem('pmc-logdock', open ? '1' : '0'); } catch (e5) { }
          if (open) { var h = el('log-dock'); if (h) h.parentElement.scrollTop = h.parentElement.scrollHeight; }
          if (SFX) SFX.click();
        });
      }
      var fc = el('btn-feedclear');
      if (fc) fc.addEventListener('click', function () {
        var host = el('resfeed-list');
        if (host) host.innerHTML = '';
        if (SFX) SFX.click();
      });
      el('btn-menu').addEventListener('click', openMenu);
      if (el('btn-obj')) el('btn-obj').addEventListener('click', openObjectives);
      if (el('obj-modal')) el('obj-modal').addEventListener('click', function (e) {
        if (e.target === el('obj-modal') || e.target.id === 'obj-done') el('obj-modal').hidden = true;
      });

      /* Multiplayer only works when this page came from a game server. A game
         opened from a file, or the published single file, has nowhere to send an
         intent and nobody to send it to, so there the card is shown greyed out
         and disabled, saying what it needs, rather than leading to a screen that
         cannot work. */
      /* Being on http is not enough: a static host (GitHub Pages, say) serves the
         page with no game server behind it. So the card stays greyed out until
         the server's own /health answers. */
      var mb = el('btn-multi'), online = !!(window.PMCLobby && window.PMCLobby.available());
      if (mb) mb.disabled = true;
      function serverUp() {
        mb.disabled = false;
        var back = window.PMCLobby.resumable && window.PMCLobby.resumable();
        if (el('menu-multi-sub')) el('menu-multi-sub').textContent = back
          ? 'Resume your game — code ' + back : 'Play somebody else over the network';
        mb.addEventListener('click', function () {
          el('setup').hidden = true;
          if (window.PMCMenu) window.PMCMenu.close();
          window.PMCLobby.open();
        });
      }
      if (mb && online && window.fetch) {
        window.fetch('/health', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (h) { if (h && h.ok === true && h.rooms != null) serverUp(); })
          .catch(function () { });
      }
      el('btn-drawer').addEventListener('click', toggleDrawer);
      el('btn-drawer-close').addEventListener('click', closeDrawer);
      el('scrim').addEventListener('click', closeDrawer);
      drawerEl().querySelectorAll('.dtab').forEach(function (b) {
        b.addEventListener('click', function () { setDrawerTab(b.getAttribute('data-tab')); if (SFX) SFX.click(); });
      });
      setDrawerTab('forces');
      if (el('btn-notes')) el('btn-notes').addEventListener('click', function () { el('notes').hidden = false; });

      // the same switch on the top bar and on the menu
      var sndBtns = [el('btn-sound'), el('btn-menu-sound')].filter(Boolean);
      function paintSound() {
        var live = SFX && SFX.enabled();
        sndBtns.forEach(function (b) {
          b.textContent = live ? 'Sound on' : 'Sound off';
          b.setAttribute('aria-pressed', live ? 'true' : 'false');
          b.style.opacity = live ? '' : '.55';
        });
      }
      sndBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (!SFX) return;
          SFX.setEnabled(!SFX.enabled());
          paintSound();
          if (SFX.enabled()) SFX.chime();
        });
      });
      paintSound();
      document.addEventListener('pointerdown', function unlock() {
        if (SFX) SFX.unlock();
        document.removeEventListener('pointerdown', unlock);
      });
      el('btn-notes-close').addEventListener('click', function () { el('notes').hidden = true; });
      el('resolution').addEventListener('click', function (e) { if (e.target.id === 'resolution') closeRes(); });
    }

    return {
      wireChrome: wireChrome,
      closeDrawer: closeDrawer,
      drawBar: drawBar,
      drawLog: drawLog,
      drawOdds: drawOdds,
      drawPanel: drawPanel,
      drawStats: drawStats,
      drawerEl: drawerEl,
      esc: esc,
      oddsOn: oddsOn,
      revealConsole: revealConsole,
      roundRect: roundRect,
      setDrawerTab: setDrawerTab,
      setHint: setHint,
      tip: tip,
      toggleDrawer: toggleDrawer
    };
  };
})(window);
