/* PMC 2670 — Firefight : mustering a force.

   The muster screen (a company, or a solitaire commando, built against the
   composition tables), the skirmish forces saved to this browser, and the
   two-force skirmish mustered in three steps — hotseat, against the AI,
   solitaire, co-op or over the network.

   It is installed by game.js, which hands it what it borrows from the game
   (G) and takes back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCMuster = function (G) {
    var ISO = G.ISO, R = G.R, SC = G.SC, el = G.el, esc = G.esc, cam = G.cam;
    var begin = G.begin, openMenu = G.openMenu, colourLabel = G.colourLabel, drawColourPick = G.drawColourPick, foeColour = G.foeColour;

    var muster = { keys: [], name: '', solo: false };
    var SOLO = window.PMCSolo, SFX = window.SFX, U = window.PMCUi;

    /* The composition check the muster screen is building against: the standard
       table, or in a solitaire game the commando table (p. 147). */
    function musterCheck(keys) {
      if (muster.solo) return SOLO.checkCommando(keys, musterTier(), musterPL(), musterFaction());
      return R.checkArmy(keys, musterTier(), musterPL(), null, musterTactic(), musterFaction());
    }
    function musterLimits(tier, pl, c) {
      if (muster.solo) return c.limits;
      return R.compFor(musterFaction(), tier).limits.map(function (l) { return [l[0] * pl, l[1] === 99 ? 99 : l[1] * pl]; });
    }
    function setSoloMode(on) {
      muster.solo = on;
      el('setup').classList.toggle('solo-mode', on);
      el('solo-box').hidden = !on;
      el('setup-title').textContent = on ? 'Muster your commando' : 'Muster your force';
      muster.keys = []; muster.name = '';
      drawMuster();
    }

    function musterTier() { return parseInt(el('sel-tier').value, 10) || 3; }
    function musterPL() { return parseInt(el('sel-pl').value, 10) || 1; }
    function musterFaction() { return el('sel-faction') ? el('sel-faction').value : 'pmc'; }
    /* A rebel force's tactic is not mustered: it is chosen at the start of the
       battle, once the attacker and defender are known and before the terrain
       goes down (p. 95; engine.js tacticStep). The list is built without one. */
    function musterTactic() { return null; }

    // would this unit still be legal if one more were added?
    function hasRoom(p) {
      var trial = muster.keys.concat([p.key]);
      if (muster.solo && !SOLO.usable(p)) return false;
      var c = musterCheck(trial);
      if (c.spent > c.budget) return false;
      for (var i = 0; i < c.faults.length; i++) {
        // a shortfall of the battle tier's own units is fine while building
        if (c.faults[i].indexOf('Needs at least') !== 0) return false;
      }
      return true;
    }

    // a unit's numbers in one short line, as the add list and the chosen cards show them (the campaign's founding too)
    window.PMC_STAT_SHORT = function (p) { return statLine(p); };
    function statLine(p) {
      if (p.cls && p.cls !== 'infantry') {
        return (p.cls === 'aircraft' ? 'aircraft' : 'vehicle') +
          ' · M' + p.move + (p.turn ? ' (' + p.turn + ')' : '') +
          ' · FP' + (p.fp === null ? '—' : p.fp) + ' · ' + p.range + '" · Def ' + p.def +
          ' · A' + p.assault + ' · Str ' + p.str +
          (p.transport ? ' · carries ' + p.transport : '') +
          (p.turretSet > 1 ? ' · a set of ' + p.turretSet : '');
      }
      return p.size + ' models · M' + p.move + ' · FP' + (p.fp === null ? '—' : p.fp) +
        ' · ' + p.range + '" · Def ' + p.def + (p.defPierced ? '/' + p.defPierced : '') +
        ' · A' + p.assault + ' · Mor ' + p.morale;
    }

    /* The Battle Tier list gives each Tier's composition points: a commando's own
       table in solitaire and co-op (p. 147 — a Rebel commando gets more, in place of
       a tactic), a swarm's for the Bugs, the standard table otherwise. */
    function tierLabels() {
      var sel = el('sel-tier');
      if (!sel || !sel.options) return;
      // the Tier alone: what it is worth in points is on the muster's head
      Array.prototype.forEach.call(sel.options, function (o) { o.textContent = R.ROMAN[+o.value]; });
    }
    function drawMuster() {
      tierLabels();
      var tier = musterTier(), pl = musterPL(), faction = musterFaction(), tactic = musterTactic();
      var c = musterCheck(muster.keys);
      var lims = musterLimits(tier, pl, c);
      /* Changing a force from the battlefield: its button is Done, greyed out (still
         pressable, saying why) until the force is a legal one */
      var sb = el('btn-start'), hh = muster.hot;
      if (sb && hh && hh.step < 3 && hh.edit && hh.kind !== 'net') {
        sb.setAttribute('aria-disabled', String(!c.ok));
        if (c.ok) sb.removeAttribute('data-tip'); else sb.setAttribute('data-tip', (c.faults || []).join(' ') || 'Pick some units.');
        sb.setAttribute('data-tip-title', 'Not legal yet');
      } else if (sb) { sb.removeAttribute('aria-disabled'); sb.removeAttribute('data-tip'); }

      var tf = el('tactic-field');
      // Rebels cannot use Tactics in a solitaire game; they get the extra points instead (p. 145)
      if (tf) tf.hidden = true;
      var mh = document.querySelector('.muster-head b');
      if (mh) mh.textContent = muster.hot && muster.hot.step < 3
        ? (muster.hot.kind === 'ai' || muster.hot.kind === 'solo' || muster.hot.kind === 'net' || muster.hot.kind === 'build' ? hotWho(muster.hot.step) : hotWho(muster.hot.step) + '\u2019s ' + (muster.solo ? 'commando' : 'force'))
        : muster.solo
        ? 'Your commando'
        : musterFaction() === 'bugs' ? 'Your swarm' : musterFaction() === 'xeno' ? 'Your tribe' : musterFaction() === 'rebel' ? 'Your group' : 'Your company';
      armyLine();
      var tn = el('tactic-note');
      if (tn) {
        var td = tactic ? R.tacticById(tactic) : null;
        tn.textContent = td ? td.text : (faction === 'rebel'
          ? 'A rebel force may take one tactic, or none. It is declared once the scenario is known but before a single piece of terrain is placed — and never in a solitaire game.'
          : '');
      }
      var pts = el('pts');
      // units a tactic or doctrine puts off the bill are named, or the sum looks wrong
      pts.textContent = c.spent + ' / ' + c.budget + ' points';
      /* Human Wave Attacks (p. 95): two infantry units of the Battle Tier a Priority
         Level come off the bill. Which ones are free is marked on their chips, and
         the sum is written out under the Tier counts, so 7 Tier III units costing
         9 points reads as the rule rather than a mistake. */
      var freeIdx = {}, waveN = 0, gross = 0;
      muster.keys.forEach(function (k, i) {
        var fp = R.profile(R.splitPick(k).key);
        if (!fp) return;
        gross += fp.tier;
        if (tactic === 'wave' && !muster.solo && waveN < 2 * pl && fp.cls === 'infantry' && fp.tier === tier) { freeIdx[i] = true; waveN++; }
      });
      var note = el('pts-note');
      if (!note) {
        note = document.createElement('p'); note.id = 'pts-note'; note.className = 'ptsnote';
        el('limits').parentNode.insertBefore(note, el('limits').nextSibling);
      }
      var off = gross - c.spent;
      note.hidden = !off;
      note.innerHTML = off
        ? gross + ' pts of units \u2212 <b>' + off + ' free</b>' +
          (waveN ? ' (Human Wave Attacks: ' + waveN + ' Tier ' + R.ROMAN[tier] + ' infantry \u2014 up to 2 per Priority Level)' : '') +
          ' = <b>' + c.spent + '</b> of ' + c.budget
        : '';
      pts.classList.toggle('over', c.spent > c.budget);

      // the count at each Tier against its limits, on one line: I 1/0-8 · II 0/0-8 · …
      el('limits').innerHTML = (muster.solo ? 'Commando — ' : '') + U.limitsLine(lims, c.counts);

      el('chosen').innerHTML = muster.keys.map(function (k, i) {
        var pick = R.splitPick(k), p = R.profile(pick.key);
        if (!p) return '';
        var props = R.propsFor(p);
        var drive = props.length
          ? '<select class="drive" data-drive="' + i + '" title="Propulsion">' +
          props.map(function (pr) {
            var d = R.PROPULSION[pr];
            return '<option value="' + pr + '"' + ((pick.prop || R.defaultDrive(p) || 'wheeled') === pr ? ' selected' : '') +
              '>' + d.name + '</option>';
          }).join('') + '</select>'
          : '';
        var drone = R.canBeDrone(p)
          ? '<button type="button" class="drone' + (pick.drone ? ' on' : '') + '" data-drone="' + i +
          '" title="Drone Control: +1 Structure, no crew — but enemy Hackers can reach it">DRN</button>'
          : '';
        var mnt = R.canMount(p, pick.riders)
          ? '<select class="drive" data-mount="' + i + '" title="What they ride: a motorbike can go in a transport but bogs down in rough ground; a grav bike ignores the ground at \u22121 Defence; a horse jumps walls but takes 1 more SP whenever it is shot at">' +
          R.MOUNT_ORDER.map(function (m) {
            return '<option value="' + m + '"' + ((pick.mount || 'none') === m ? ' selected' : '') + '>' + R.MOUNTS[m].name + '</option>';
          }).join('') + '</select>'
          : '';
        var ride = R.canRide(p)
          ? '<button type="button" class="drone' + (pick.riders ? ' on' : '') + '" data-riders="' + i +
          '" title="Riders upgrade: half the models, Movement 10, and the Riders rule — no buildings, no walls, no lifts">RDR</button>'
          : '';
        /* a card each, as the campaign's founding shows them: name and kind, Tier,
           its numbers as fielded (drive and drone worked in), its rules, its
           options and the way to take it off the list */
        var u0 = R.applyDrone(R.applyPropulsion(Object.assign({}, p, { rules: (p.rules || []).slice(), models: p.size }),
          pick.prop || R.defaultDrive(p)), !!pick.drone);
        // the add list's shorthand, with the numbers as fielded (drive, drone and riders worked in)
        var line = statLine(Object.assign({}, u0, { size: pick.riders ? Math.ceil(u0.size / 2) : u0.size, move: Math.floor(u0.move) }));
        return '<div class="fcard' + (freeIdx[i] ? ' free' : '') + '">' +
          '<div class="fcard-top"><span class="ct">' + R.ROMAN[p.tier] + '</span><b>' + esc(p.name) + (pick.riders ? ' (mounted)' : '') + '</b>' +
          '<span class="fcard-kind">' + esc(p.group || '') + '</span>' +
          (freeIdx[i] ? '<i class="freetag" title="Free: an extra unit from Human Wave Attacks">FREE</i>' : '') +
          drive + drone + ride + mnt +
          '<button type="button" class="lnk danger fcard-drop" data-drop="' + i + '" title="Remove" aria-label="Remove ' + esc(p.name) + '">\u2715</button></div>' +
          '<div class="fcard-line">' + esc(line) + '</div>' +
          U.ruleMarks(u0.rules) + '</div>';
      }).join('');
      el('chosen').classList.add('fcards');

      var f = el('faults');
      if (!muster.keys.length) {
        f.textContent = muster.hot ? (muster.hot.kind === 'ai' || muster.hot.kind === 'demo' ? 'Add units, or roll a random force.' : 'Add units, or roll a force.')
          : 'Pick units from the list below, or roll a force.';
        f.className = 'faults';
      }
      else if (c.ok) { f.textContent = 'A legal ' + (muster.solo ? 'commando' : 'company') + ' at Battle Tier ' + R.ROMAN[tier] + ', Priority Level ' + pl + '.'; f.className = 'faults ok'; }
      else { f.textContent = c.faults.join(' '); f.className = 'faults'; }

      var groups = [], seen = {};
      (muster.solo ? SOLO.catalogue(faction) : R.listFor(faction)).forEach(function (p) {
        if (!seen[p.group]) { seen[p.group] = []; groups.push(p.group); }
        seen[p.group].push(p);
      });
      el('cat').innerHTML = groups.map(function (g) {
        return '<h4>' + g + '</h4>' + seen[g].map(function (p) {
          var allowed = lims[p.tier - 1][1] > 0;
          var ok = allowed && hasRoom(p);
          var why = !allowed ? 'Tier ' + R.ROMAN[p.tier] + ' units cannot be fielded at Battle Tier ' + R.ROMAN[tier]
            : ok ? ((p.rules.join(', ') || 'No special rules') +
              (R.propsFor(p).length ? ' — pick its propulsion once it is in the list' : ''))
              : 'No room left — over points, or at this unit\'s limit';
          return U.unitRow('type="button" class="cu" data-add="' + p.key + '"' + (ok ? '' : ' disabled') + ' title="' + why + '"', p.tier,
            p.name, statLine(p) + (p.rules.length ? ' · ' + p.rules.join(', ') : ''), null);
        }).join('');
      }).join('');

    }

    /* ================= saved skirmish forces =================
       A force that took ten minutes to put together should not have to be built
       again next time. Each one is kept whole — the units and their propulsions
       and upgrades, but also the Battle Tier, the Priority Level, the faction,
       the rebel tactic and the colour — because a list of units without the Tier
       it was legal at is not a force, it is a pile of names.

       They live in this browser, and they export to a file so a force can be
       carried to another device or handed to an opponent. */
    var FORCE_KEY = 'pmc-forces';

    function loadForces() {
      try {
        var raw = localStorage.getItem(FORCE_KEY);
        var list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter(isForce) : [];
      } catch (e) { return []; }
    }
    function saveForces(list) {
      try { localStorage.setItem(FORCE_KEY, JSON.stringify(list)); return true; }
      catch (e) { return false; }
    }
    function isForce(f) {
      return !!f && typeof f.name === 'string' && Array.isArray(f.keys);
    }

    // everything about the force as it stands, in one object
    function currentForce(name) {
      return {
        v: 1,
        name: name,
        faction: musterFaction(),
        tier: musterTier(),
        pl: musterPL(),
        tactic: musterTactic(),
        colour: muster.colour || 'ochre',
        keys: muster.keys.slice(),
        saved: new Date().toISOString().slice(0, 10)
      };
    }

    /* Put a saved force back on the screen. A saved file can be older than the
       army list it was built from, so every unit is checked against the
       catalogue and anything that no longer exists is dropped and reported
       rather than quietly breaking the muster. */
    function applyForce(f) {
      if (!isForce(f)) return { ok: false, why: 'That file is not a saved force.' };
      var lost = [];
      var keys = f.keys.filter(function (k) {
        var pick = R.splitPick(k);
        if (R.profile(pick.key)) return true;
        lost.push(pick.key);
        return false;
      });
      // a demo force keeps the battle's Tier and Priority Level, its colour, and a name from its colour and kind
      var demo = muster.hot && muster.hot.kind === 'demo';
      if (el('sel-faction') && f.faction) el('sel-faction').value = f.faction;
      if (el('sel-tier') && f.tier && !demo) el('sel-tier').value = String(f.tier);
      if (el('sel-pl') && f.pl && !demo) el('sel-pl').value = String(f.pl);
      if (el('sel-tactic')) el('sel-tactic').value = f.tactic || '';
      if (f.colour && ISO.COLOURS[f.colour] && !demo) {
        muster.colour = f.colour;
        try { localStorage.setItem('pmc-colour', f.colour); } catch (e) { }
      }
      muster.keys = keys;
      muster.name = f.name || '';
      if (demo) { muster.demoNoun = null; demoRename(); }
      muster.opFaction = null;                 // let the opposition follow again
      if (el('force-name')) el('force-name').value = f.name || '';
      drawMuster();
      return { ok: true, lost: lost, force: f };
    }

    function forceNote(text, tone) {
      var n = el('force-note');
      if (!n) return;
      n.textContent = text || '';
      n.className = 'forcenote' + (tone ? ' ' + tone : '');
    }

    /* Every saved force to load: this browser's (by their index, as they always
       were) and, for a player signed in to the game server, their account's
       (the force builder's too: src/net/forces.js). */
    function accountForces() { return root.PMCForces ? root.PMCForces.list('skirmish').filter(function (e) { return e.where === 'account'; }) : []; }
    function savedForce(v) {
      if (/^s:/.test(v || '')) { var e = root.PMCForces && root.PMCForces.find('skirmish', v); return e ? e.force : null; }
      return loadForces()[parseInt(v, 10)];
    }
    function drawForceList() {
      var sel = el('sel-force');
      if (!sel) return;
      var list = loadForces(), acct = accountForces();
      var cur = sel.value;
      function opt(f, v) {
        var sub = R.ROMAN[f.tier] + '/' + f.pl + ' · ' + f.keys.length + ' units';
        return '<option value="' + v + '">' + esc(f.name) + ' — ' + sub + '</option>';
      }
      sel.innerHTML = '<option value="">' +
        (list.length || acct.length ? 'Saved forces…' : 'No saved forces yet') + '</option>' +
        (acct.length && list.length ? '<optgroup label="In this browser">' : '') +
        list.map(function (f, i) { return opt(f, i); }).join('') +
        (acct.length && list.length ? '</optgroup>' : '') +
        (acct.length ? '<optgroup label="On your account">' + acct.map(function (e) { return opt(e.force, e.ref); }).join('') + '</optgroup>' : '');
      if (cur && savedForce(cur)) sel.value = cur;
      var del = document.querySelector('[data-force="del"]');
      if (del) del.disabled = !sel.value;
    }

    function saveCurrentForce() {
      var input = el('force-name');
      var name = (input ? input.value : '').trim();
      if (!muster.keys.length) { forceNote('There is nothing in the force to save yet.', 'bad'); return; }
      if (!name) {
        forceNote('Give the force a name first.', 'bad');
        if (input) input.focus();
        return;
      }
      // signed in to the game server: kept on the account, where the force builder keeps them too
      if (root.PMCForces && root.PMCForces.signedIn()) {
        var fa = currentForce(name);
        root.PMCForces.save('skirmish', fa, function (r) {
          if (!r.ok) { forceNote(r.why, 'bad'); return; }
          muster.name = name;
          drawForceList();
          if (el('sel-force')) el('sel-force').value = r.ref;
          var del0 = document.querySelector('[data-force="del"]');
          if (del0) del0.disabled = false;
          forceNote((r.replaced ? 'Replaced' : 'Saved') + ' "' + name + '" on your account — ' + fa.keys.length +
            ' units at Battle Tier ' + R.ROMAN[fa.tier] + ', Priority Level ' + fa.pl + '.', 'ok');
        });
        return;
      }
      var list = loadForces();
      var at = -1;
      for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === name.toLowerCase()) at = i;
      var f = currentForce(name);
      if (at >= 0) list[at] = f; else list.push(f);
      if (!saveForces(list)) {
        forceNote('This browser will not let the game save — try the file instead.', 'bad');
        return;
      }
      muster.name = name;
      drawForceList();
      if (el('sel-force')) el('sel-force').value = String(at >= 0 ? at : list.length - 1);
      var del = document.querySelector('[data-force="del"]');
      if (del) del.disabled = false;
      forceNote((at >= 0 ? 'Replaced' : 'Saved') + ' "' + name + '" — ' + f.keys.length +
        ' units at Battle Tier ' + R.ROMAN[f.tier] + ', Priority Level ' + f.pl + '.', 'ok');
    }

    function deleteForce() {
      var sel = el('sel-force');
      if (!sel || !sel.value) return;
      if (/^s:/.test(sel.value)) {
        var fs = savedForce(sel.value);
        root.PMCForces.remove('skirmish', sel.value, function (r) {
          sel.value = '';
          drawForceList();
          forceNote(r.ok ? 'Deleted "' + (fs ? fs.name : 'the force') + '" from your account.' : 'The server would not delete it.', r.ok ? '' : 'bad');
        });
        return;
      }
      var list = loadForces();
      var f = list[parseInt(sel.value, 10)];
      if (!f) return;
      list.splice(parseInt(sel.value, 10), 1);
      saveForces(list);
      sel.value = '';
      drawForceList();
      forceNote('Deleted "' + f.name + '".');
    }

    function exportForce() {
      var name = (el('force-name') ? el('force-name').value : '').trim() || muster.name || 'force';
      if (!muster.keys.length) { forceNote('There is nothing in the force to save yet.', 'bad'); return; }
      var f = currentForce(name);
      var blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() + '.pmcforce.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      forceNote('Written to ' + a.download + '.', 'ok');
    }

    function importForce(file) {
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        var f;
        try { f = JSON.parse(rd.result); } catch (e) {
          forceNote('That file could not be read.', 'bad');
          return;
        }
        var r = applyForce(f);
        if (!r.ok) { forceNote(r.why, 'bad'); return; }
        forceNote('Loaded "' + (f.name || 'a force') + '"' +
          (r.lost.length ? ' — ' + r.lost.length + ' unit' + (r.lost.length > 1 ? 's are' : ' is') +
            ' no longer in the army list and were left out.' : '.'),
          r.lost.length ? 'bad' : 'ok');
        drawForceList();
      };
      rd.readAsText(file);
    }

    /* "When playing Tier I or Tier II battle and/or Priority 1 battle" the D3
       roll among the first three scenarios is allowed (p. 45); otherwise it is off. */
    function d3Allowed() { return musterTier() <= 2 || musterPL() === 1; }
    function gateD3() {
      var sel = el('sel-scen');
      var opt = sel && sel.querySelector('option[value="rolld3"]');
      if (!opt) return;
      opt.disabled = !d3Allowed();
      if (opt.disabled && sel.value === 'rolld3') sel.value = 'roll';
    }

    function wireMuster() {
      ['sel-tier', 'sel-pl'].forEach(function (id) { if (el(id)) el(id).addEventListener('change', gateD3); });
      gateD3();
      ['sel-tier', 'sel-pl', 'sel-faction'].forEach(function (id) {
        if (!el(id)) return;
        el(id).addEventListener('change', function () {
          // a demo sets its Tier and Priority Level on the battlefield: both forces are rolled again to match
          /* Against the AI the player's own force is kept if it is still legal, and rolled again only if not. */
          if (id !== 'sel-faction' && muster.hot && hotQuick(muster.hot.kind) && muster.hot.step === 3) {
            muster.hot.sides.forEach(function (sd, i) {
              if (!sd) return;
              // a force a player musters is kept if it is empty or still legal; only the AI's is rolled again
              var hk = muster.hot.kind, cmd = hk === 'coop' || hk === 'solo';
              var chk = cmd ? SOLO.checkCommando(sd.keys, musterTier(), musterPL(), sd.faction)
                : R.checkArmy(sd.keys, musterTier(), musterPL(), null, sd.tactic, sd.faction);
              if (hotOwn(hk) && !(hk === 'ai' && i === 1) && (!sd.keys.length || chk.ok)) return;
              sd.keys = cmd ? SOLO.rollCommando(musterTier(), musterPL(), sd.faction) : R.rollArmy(musterTier(), musterPL(), null, sd.faction, sd.style || undefined);
            });
            hotPaint(); return;
          }
          muster.keys = []; muster.name = '';
          /* A swarm comes in olive drab unless its colour has been chosen: switching
             to the Bugs from an untouched ochre (or back) swaps the default over. */
          if (id === 'sel-faction' && !muster.colourChosen) {
            var fdef = musterFaction() === 'bugs' ? 'olive' : 'ochre';
            if (muster.colour === 'ochre' || muster.colour === 'olive') { muster.colour = fdef; if (typeof drawColourPick === 'function') drawColourPick(); }
          }
          if (id === 'sel-faction' && muster.hot) hotLabels();
          // a force the player musters: a made-up name follows the kind of force
          if (id === 'sel-faction' && muster.hot && muster.hot.kind !== 'demo' && !hotRolled(muster.hot.step)) {
            var hn = el('hot-name'), nm = ((hn && hn.value) || '').trim();
            if (!nm || isMadeUpName(nm)) { muster.name = U.forceName(muster.colour, musterFaction()); if (hn) hn.value = muster.name; }
          }
          // a force that starts rolled keeps a rolled build, whatever it is changed to
          if (muster.hot && muster.hot.step < 3 && hotRolled(muster.hot.step)) hotRandomise(muster.hot.step - 1, true);
          if (el('sel-force')) el('sel-force').value = '';
          var db = document.querySelector('[data-force="del"]');
          if (db) db.disabled = true;
          forceNote('');
          drawMuster();
        });
      });
      if (el('sel-tactic')) el('sel-tactic').addEventListener('change', drawMuster);
      el('chosen').addEventListener('click', function (e) {
        var dr = e.target.closest('[data-drone]');
        if (dr) {
          var di = parseInt(dr.getAttribute('data-drone'), 10);
          var dp = R.splitPick(muster.keys[di]);
          muster.keys[di] = R.joinPick(dp.key, dp.prop, !dp.drone, dp.riders, dp.mount);
          drawMuster();
          return;
        }
        var rb = e.target.closest('[data-riders]');
        if (rb) {
          var ri = parseInt(rb.getAttribute('data-riders'), 10);
          var rp = R.splitPick(muster.keys[ri]);
          muster.keys[ri] = R.joinPick(rp.key, rp.prop, rp.drone, !rp.riders, rp.mount);
          drawMuster();
          return;
        }
        var b = e.target.closest('[data-drop]');
        if (!b) return;
        muster.keys.splice(parseInt(b.getAttribute('data-drop'), 10), 1);
        muster.name = '';
        drawMuster();
      });
      el('chosen').addEventListener('change', function (e) {
        var ms = e.target.closest('[data-mount]');
        if (ms) {
          var mi = parseInt(ms.getAttribute('data-mount'), 10);
          var mp = R.splitPick(muster.keys[mi]);
          muster.keys[mi] = R.joinPick(mp.key, mp.prop, mp.drone, mp.riders, ms.value);
          drawMuster();
          return;
        }
        var sel = e.target.closest('[data-drive]');
        if (!sel) return;
        var i = parseInt(sel.getAttribute('data-drive'), 10);
        var cur = R.splitPick(muster.keys[i]);
        muster.keys[i] = R.joinPick(cur.key, sel.value, cur.drone, cur.riders, cur.mount);
        drawMuster();
      });
      el('cat').addEventListener('click', function (e) {
        var b = e.target.closest('[data-add]');
        if (!b || b.disabled) return;
        // a hull goes in on the running gear it usually goes to war on
        var addP = R.profile(b.getAttribute('data-add'));
        var addD = R.defaultDrive(addP);
        muster.keys.push(addD ? R.joinPick(addP.key, addD) : addP.key);
        muster.name = '';
        drawMuster();
      });
      document.querySelector('.muster-btns').addEventListener('click', function (e) {
        var b = e.target.closest('[data-army]');
        if (!b) return;
        if (b.getAttribute('data-army') === 'random') {
          // a random kind of force, rolled: in a stepped muster it keeps its colour and takes a name to match
          if (muster.hot && muster.hot.step < 3) hotRandomise(muster.hot.step - 1, false, true);
          else {
            var rf = HOT_FACTIONS[Math.floor(Math.random() * HOT_FACTIONS.length)];
            el('sel-faction').value = rf;
            if (el('sel-tactic')) el('sel-tactic').value = '';
            muster.keys = muster.solo ? SOLO.rollCommando(musterTier(), musterPL(), rf) : R.rollArmy(musterTier(), musterPL(), null, rf);
            muster.name = U.personaName(muster.keys) || '';
          }
        } else if (b.getAttribute('data-army') === 'roll' && muster.solo) {
          muster.keys = SOLO.rollCommando(musterTier(), musterPL(), musterFaction());
          muster.name = 'Commando';
        } else if (b.getAttribute('data-army') === 'roll') {
          muster.keys = R.rollArmy(musterTier(), musterPL(), null, musterFaction());
          muster.name = U.personaName(muster.keys) || 'Battle Tier ' + R.ROMAN[musterTier()] +
            (musterFaction() === 'rebel' ? ' insurgent group' : musterFaction() === 'bugs' ? ' swarm' : musterFaction() === 'xeno' ? ' tribe' : ' company');
        } else { muster.keys = []; muster.name = ''; }
        // in a stepped muster a rolled force takes its personality's name, unless the player has typed one
        // (online, a force keeps the name of its seat: it is how the players tell each other apart)
        var hn = el('hot-name'), pn = muster.hot && muster.hot.kind !== 'net' && hn && U.personaName(muster.keys, hn.value.trim(), otherName());
        if (pn) {
          var cur = hn.value.trim();
          if (!cur || isMadeUpName(cur) || isDemoName(cur) || /^(Player [12]( Force)?|Your Force)$/.test(cur)) { muster.name = pn; hn.value = pn; }
        }
        drawMuster();
      });
      var bar = document.querySelector('.forcebar');
      if (bar) {
        bar.addEventListener('click', function (e) {
          var b = e.target.closest('[data-force]');
          if (!b || b.disabled) return;
          var what = b.getAttribute('data-force');
          if (what === 'save') saveCurrentForce();
          else if (what === 'del') deleteForce();
          else if (what === 'export') exportForce();
          else if (what === 'import') el('force-file').click();
        });
        el('sel-force').addEventListener('change', function () {
          var sel = el('sel-force');
          document.querySelector('[data-force="del"]').disabled = !sel.value;
          if (!sel.value) { forceNote(''); return; }
          var f = savedForce(sel.value);
          var r = applyForce(f);
          if (!r.ok) { forceNote(r.why, 'bad'); return; }
          // applyForce redraws, which rebuilds nothing here — put the pick back
          el('sel-force').value = sel.value;
          forceNote('Loaded "' + f.name + '"' +
            (r.lost.length ? ' — ' + r.lost.length + ' unit' + (r.lost.length > 1 ? 's are' : ' is') +
              ' no longer in the army list and were left out.' : ', saved ' + f.saved + '.'),
            r.lost.length ? 'bad' : 'ok');
        });
        el('force-file').addEventListener('change', function (e) {
          importForce(e.target.files && e.target.files[0]);
          e.target.value = '';
        });
        // Enter in the name box saves, because that is what Enter is for
        el('force-name').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); saveCurrentForce(); }
        });
        drawForceList();
      }
      // open empty, with the whole list live to pick from
      drawMuster();
      wireSheet();
    }
    /* The sheet's own buttons: back, roll again, clear, the colour pop-up, the
       unit and army modals, the saved forces, the hotseat summary, Take the
       field, and the terrain set-up choice this browser remembers. */
    function wireSheet() {
      if (el('btn-setup-back')) el('btn-setup-back').addEventListener('click', setupBack);
      // a demo force: rolled again as the same kind, or loaded and saved from a modal
      if (el('btn-demo-roll')) el('btn-demo-roll').addEventListener('click', function () {
        if (!muster.hot || muster.hot.step > 2) return;
        hotRandomise(muster.hot.step - 1, true, true);
        drawMuster();
      });
      if (el('btn-quick-clear')) el('btn-quick-clear').addEventListener('click', function () {
        if (!muster.hot || muster.hot.step > 2) return;
        muster.keys = [];
        drawMuster();
      });
      // the units to pick from, in a modal
      if (el('btn-colour-pop')) el('btn-colour-pop').addEventListener('click', function (ev) {
        ev.stopPropagation();
        colourPop(!el('colour-wrap').classList.contains('open'));
      });
      // a tap anywhere else puts it away
      document.addEventListener('click', function (ev) {
        var cw = el('colour-wrap');
        if (cw && cw.classList.contains('open') && !cw.contains(ev.target)) colourPop(false);
      });
      if (el('btn-cat-open')) el('btn-cat-open').addEventListener('click', function () { catModal(true); });
      if (el('btn-army')) el('btn-army').addEventListener('click', function () { armyModal(true); });
      if (el('btn-army-done')) el('btn-army-done').addEventListener('click', function () { armyModal(false); });
      if (el('army-modal')) el('army-modal').addEventListener('click', function (ev) {
        if (ev.target === el('army-modal')) { armyModal(false); return; }
        var a = ev.target.closest('[data-army-pick]'), t = ev.target.closest('[data-tactic-pick]');
        if (a) pickInto('sel-faction', a.getAttribute('data-army-pick'));
        else if (t) pickInto('sel-tactic', t.getAttribute('data-tactic-pick'));
        else return;
        if (SFX) SFX.click();
        drawArmyModal();
      });
      if (el('btn-cat-add2')) el('btn-cat-add2').addEventListener('click', function () { catModal(true); });
      if (el('btn-cat-done')) el('btn-cat-done').addEventListener('click', function () { catModal(false); });
      if (el('cat-back')) el('cat-back').addEventListener('click', function () { catModal(false); });
      var saves = el('forcebar-wrap');
      if (el('btn-demo-saves')) el('btn-demo-saves').addEventListener('click', function () { saves.classList.add('open'); });
      if (el('btn-saves')) el('btn-saves').addEventListener('click', function () { saves.classList.add('open'); });
      if (el('btn-demo-saves-done')) el('btn-demo-saves-done').addEventListener('click', function () { saves.classList.remove('open'); });
      if (saves) saves.addEventListener('click', function (ev) { if (ev.target === saves) saves.classList.remove('open'); });
      if (el('hot-sum')) {
        el('hot-sum').addEventListener('click', function (ev) {
          var t = ev.target.closest && ev.target.closest('button');
          if (!t || t.disabled) return;
          var h = muster.hot;
          if (t.hasAttribute('data-hotcolour')) { var ci = hotLine(t.getAttribute('data-hotcolour')); hotColourFor(h && h.colourFor === ci ? null : ci); return; }
          if (t.hasAttribute('data-hotcol')) { if (h && h.colourFor != null) hotColour(h.colourFor, t.getAttribute('data-hotcol')); return; }
          if (t.hasAttribute('data-hotside')) hotEdit(+t.getAttribute('data-hotside'));
        });
        el('hot-sum').addEventListener('change', function (ev) {
          var s = ev.target.closest && ev.target.closest('[data-hotarmy]');
          if (s) hotArmy(hotLine(s.getAttribute('data-hotarmy')), s.value);
          var ps = ev.target.closest && ev.target.closest('[data-hotstyle]');
          if (ps) hotStyle(+ps.getAttribute('data-hotstyle'), ps.value);
        });
        // a force's colours, open by its chip: a tap anywhere else puts them away
        document.addEventListener('click', function (ev) {
          var h = muster.hot;
          if (!h || h.colourFor == null || !ev.target.closest) return;
          if (ev.target.closest('#hot-sum .olob-pop') || ev.target.closest('[data-hotcolour]')) return;
          hotColourFor(null);
        });
        var hs = el('setup') && el('setup').querySelector('.sheet');
        if (hs) hs.addEventListener('scroll', hotPlacePop);
        window.addEventListener('resize', hotPlacePop);
      }
      el('btn-start').addEventListener('click', function () {
        /* The lobby borrowed this screen to have a force built. Hand the force
           back rather than starting a battle: the one that matters is being
           arranged in the room, and it starts when both sides say so. */
        if (muster.forLobby && !(muster.hot && muster.hot.kind === 'net')) {
          var want = muster.forLobby;
          muster.forLobby = null;
          el('setup').hidden = true;
          want.done(window.PMC_MUSTER_NOW());
          return;
        }
        // every skirmish is mustered in steps now: Take the field is the next one
        if (muster.hot) hotNext();
      });
      /* The terrain set-up choice is remembered, and a campaign battle — which
         starts without this screen — uses whichever was picked last. */
      (function () {
        var st = el('sel-terrain');
        if (!st) return;
        try { var v = localStorage.getItem('pmc-terrainsetup'); if (v) st.value = v; } catch (e) { }
        st.addEventListener('change', function () { try { localStorage.setItem('pmc-terrainsetup', st.value); } catch (e) { } });
      })();
      drawColourPick();
    }

    /* ---- a two-force skirmish, mustered in three steps ----
       Hotseat, co-op and demo all build two forces on this screen in turn, and
       then settle the battlefield. In a hotseat each player builds a force of
       their own — kind, name, colours and units — at the Battle Tier and Priority
       Level the first player set. In co-op each builds a commando from the
       commando table (p. 147); the two share a side and a colour on the table,
       and the battlefield step picks the OpFor and the solitaire scenario. A demo
       has two AI forces, each starting as a random kind of force with a rolled
       build, to change or keep; against the AI, the player builds their own and
       the opposition starts that way. Each step keeps what was built, so Back
       loses nothing. */
    var HOT_FACTIONS = ['pmc', 'rebel', 'bugs', 'xeno'];
    var FORCE_KIND = { pmc: 'Mercenary company', rebel: 'Insurgent group', bugs: 'Bug swarm', xeno: 'Xenotripod tribe' };
    function hotWho(step) {
      var k = muster.hot.kind;
      if (k === 'ai') return step === 1 ? 'Your force' : 'The opposition';
      if (k === 'solo') return 'Your commando';
      if (k === 'net' || k === 'build') return 'Your force';
      return k === 'demo' ? 'Force ' + step : 'Player ' + step;
    }
    // does this step's force start rolled, and roll again when its kind changes?
    function hotRolled(step) {
      var k = muster.hot && muster.hot.kind;
      return k === 'demo' || (k === 'ai' && step === 2);
    }
    // every skirmish opens on the battlefield, a card for each force (a solitaire game has just the one)
    function hotQuick(kind) { return kind === 'demo' || kind === 'ai' || kind === 'hotseat' || kind === 'coop' || kind === 'solo'; }
    // a player's own force or commando, rather than one rolled for the AI
    function hotOwn(kind) { return kind === 'ai' || kind === 'hotseat' || kind === 'coop' || kind === 'solo' || kind === 'net' || kind === 'build'; }
    /* 'build': the force builder's skirmish force (from the main menu): one
       force, at the Battle Tier and Priority Level the player sets, saved under
       its name to their account (or this browser) to be loaded into a battle
       later, from this screen's saved forces. Nothing is fought. */
    /* 'net': a network game's own force, built on the same sheet as a skirmish's
       but on its own — the other player builds theirs on their own screen, and
       the Tier and Priority Level are the host's. */
    function hotBegin(kind) {
      muster.hot = { kind: kind, step: 1, sides: kind === 'solo' || kind === 'net' || kind === 'build' ? [null] : [null, null] };
      muster.keys = []; muster.name = '';
      if (el('hot-name')) el('hot-name').value = '';
      if (kind === 'demo') hotRandomise(0);
      else if (hotOwn(kind)) {
        // the player's force starts empty, in desert ochre, as "Your force" (or Player 1's) until they name it
        muster.colour = 'ochre';
        el('sel-faction').value = 'pmc';             // a mercenary company, until they pick another kind
        drawColourPick();
        if (el('sel-tactic')) el('sel-tactic').value = '';
        muster.name = kind === 'hotseat' ? 'Player 1 Force' : kind === 'coop' ? 'Player 1' : kind === 'solo' ? 'Your commando'
          : kind === 'net' ? (muster.forLobby && muster.forLobby.seat === 'B' ? 'Player 2 Force' : 'Player 1 Force')
          : kind === 'build' ? '' : 'Your Force';
        if (el('hot-name')) el('hot-name').value = muster.name;
      }
      hotPaint();
      drawMuster();
    }
    function hotEnd() {
      if (!muster.hot) return;
      muster.hot = null;
      var s = el('setup');
      if (s) { delete s.dataset.hot; delete s.dataset.kind; delete s.dataset.quick; }
      catModal(false);
      ['sel-tier', 'sel-pl'].forEach(function (id) { if (el(id)) el(id).disabled = false; });
      el('btn-start').textContent = 'Take the field';
      var fl = document.querySelector('label[for="sel-faction"]');
      if (fl) fl.textContent = 'Your force';
      colourPop(false);
      backLabel(el('btn-setup-back'), true);
      colourHome();
      if (el('colour-hint')) el('colour-hint').textContent = 'The opponent takes a colour of its own, chosen at random from the ones you have left.';
      drawColourPick();
      drawMuster();                        // its hints were written for the stepped muster
    }
    /* A demo force is not named by anyone: it goes by its colour and a noun
       that suits its kind — the Crimson Vultures, the Jade Brood. */
    var DEMO_NOUNS = {
      pmc: ['Vultures', 'Lancers', 'Hammers', 'Jackals', 'Contractors', 'Iron Wolves', 'Hellhounds', 'Mercenaries', 'Stormguard', 'Reapers'],
      rebel: ['Liberation Front', 'Irregulars', 'Commune', 'Partisans', 'Freedom Brigade', 'Rabble', 'Barricade', 'Uprising', 'Militia', 'Resistance'],
      bugs: ['Brood', 'Hive', 'Mandibles', 'Swarm', 'Chitter', 'Nest', 'Devourers', 'Skitterers', 'Horde', 'Maw'],
      xeno: ['Tripods', 'Conclave', 'Harvesters', 'Ascendancy', 'Striders', 'Reach', 'Watchers', 'Dominion', 'Choir', 'Tribe']
    };
    function demoName(colour, noun) {
      return 'The ' + colour.charAt(0).toUpperCase() + colour.slice(1) + ' ' + noun;
    }
    function demoRename() {
      // a force rolled to a personality goes by one of its names, whatever its colours
      var pn = U.personaName(muster.keys, muster.name, otherName());
      if (pn) { muster.name = pn; if (el('hot-name')) el('hot-name').value = pn; return; }
      var f = musterFaction(), list = DEMO_NOUNS[f] || DEMO_NOUNS.pmc;
      if (list.indexOf(muster.demoNoun) < 0) muster.demoNoun = list[Math.floor(Math.random() * list.length)];
      muster.name = demoName(muster.colour || 'ochre', muster.demoNoun);
      if (el('hot-name')) el('hot-name').value = muster.name;
    }
    // a demo force: a random kind of force, a rolled build, a colour nobody else wears and a name to go with it
    function hotRandomise(i, keepFaction, keepColour) {
      var f = keepFaction ? musterFaction() : HOT_FACTIONS[Math.floor(Math.random() * HOT_FACTIONS.length)];
      el('sel-faction').value = f;
      if (el('sel-tactic')) el('sel-tactic').value = '';
      // a demo's rebels fight to a tactic, picked at random
      if (muster.hot.kind === 'demo' && f === 'rebel' && el('sel-tactic')) {
        var tacts = Array.prototype.map.call(el('sel-tactic').options, function (o) { return o.value; }).filter(Boolean);
        el('sel-tactic').value = tacts[Math.floor(Math.random() * tacts.length)] || '';
      }
      // (rolled again as the same kind: to the personality picked for it, if one was)
      var sd0 = muster.hot.sides[i], st0 = keepFaction && sd0 && sd0.faction === f ? sd0.style : null;
      muster.keys = muster.solo ? SOLO.rollCommando(musterTier(), musterPL(), f) : R.rollArmy(musterTier(), musterPL(), null, f, st0 || undefined);
      var other = muster.hot.sides[1 - i];
      if (!keepFaction && !keepColour) muster.colour = foeColour(other ? [other.colour] : []);
      // a demo force, and the AI's opposition, take a name from their colour and kind: the Jade Brood
      if (muster.hot.kind === 'demo' || (muster.hot.kind === 'ai' && i === 1)) {
        var own = ((el('hot-name') && el('hot-name').value) || '').trim();
        if (own && !isDemoName(own) && !isMadeUpName(own)) { muster.name = own; return; }   // one typed stays
        muster.demoNoun = null; demoRename(); return;
      }
      // a name the player gave it stays; one made up from its colour and kind follows them
      var typed = ((el('hot-name') && el('hot-name').value) || '').trim();
      if (typed && !isMadeUpName(typed)) { muster.name = typed; return; }
      muster.name = U.forceName(muster.colour, f, muster.keys, null, otherName());
      if (el('hot-name')) el('hot-name').value = muster.name;
    }
    // the other force's name, in a stepped muster: two of the same personality are not both Kessler Combine
    function otherName() {
      var h = muster.hot;
      if (!h || !h.sides) return null;
      var o = h.sides[2 - (h.step || 1)];
      return (o && o.name) || null;
    }
    // "The Jade Brood": a name made up from a colour, the way a demo force is named
    function isDemoName(n) {
      if (U.isPersonaName(n)) return true;
      return ISO.COLOUR_KEYS.some(function (k) { return n.indexOf(demoName(k, '')) === 0; });
    }
    // "Jade swarm": a name made up from a force's colours and kind (ui-parts.js)
    function isMadeUpName(n) { return U.isForceName(n); }
    // a force's list, copied with the personality it was rolled to (R.rollArmy keys.style)
    function copyKeys(keys) { var c = keys.slice(); if (keys.style) c.style = keys.style; return c; }
    function hotSaveSide() {
      var i = muster.hot.step - 1;
      var was = muster.hot.sides[i];
      muster.hot.sides[i] = {
        keys: copyKeys(muster.keys), faction: musterFaction(), tactic: muster.solo ? null : musterTactic(),
        // the personality picked for a rolled force, kept while it stays the same army
        style: was && was.style && was.faction === musterFaction() ? was.style : null,
        name: ((el('hot-name') && el('hot-name').value) || '').trim() || muster.name || '',
        colour: muster.colour || 'ochre', noun: muster.demoNoun || null
      };
    }
    function hotLoadSide(i) {
      var sd = muster.hot.sides[i];
      if (sd) {
        muster.keys = copyKeys(sd.keys); muster.name = sd.name; muster.colour = sd.colour; muster.demoNoun = sd.noun || null;
        el('sel-faction').value = sd.faction;
        if (el('sel-tactic')) el('sel-tactic').value = sd.tactic || '';
        if (el('hot-name')) el('hot-name').value = sd.name;
      } else if (hotRolled(i + 1)) {
        if (el('hot-name')) el('hot-name').value = '';   // a fresh force: the other one's name is not its own
        hotRandomise(i);
      } else {
        // a fresh force for the second player, in a colour the first is not wearing
        var two = i === 1 && (muster.hot.kind === 'hotseat' || muster.hot.kind === 'coop');
        muster.keys = []; muster.name = two ? (muster.hot.kind === 'coop' ? 'Player 2' : 'Player 2 Force') : '';
        if (two) muster.colour = foeColour([muster.hot.sides[0].colour]);
        if (el('hot-name')) el('hot-name').value = muster.name;
      }
    }
    // the name and colour labels follow the kind of force, as founding one does
    var ID_NOUN = { pmc: 'Company', rebel: 'Group', bugs: 'Swarm', xeno: 'Tribe' };
    function hotLabels() {
      var n = ID_NOUN[musterFaction()] || 'Force';
      if (el('hot-name-label')) el('hot-name-label').textContent = n + ' name';
      if (el('hot-name')) el('hot-name').placeholder = n + ' name';
      colourLabel();
    }
    // the colours dropped down under the chip left of the name
    function colourPop(on) {
      var cw = el('colour-wrap'), b = el('btn-colour-pop');
      if (cw) cw.classList.toggle('open', !!on);
      if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    /* The army, and a rebel force's tactic, picked in a modal: a card for each
       kind of force, and for rebels a card for each tactic with its rule in full.
       A pick goes through the selectors, so it rolls and checks as they do. */
    function armyText(v) {
      var sel = el('sel-faction');
      var o = sel && sel.options ? Array.prototype.filter.call(sel.options, function (x) { return x.value === v; })[0] : null;
      var t = o ? o.textContent : v, cut = t.indexOf(' \u2014 ');
      return cut < 0 ? { name: t, what: '' } : { name: t.slice(0, cut), what: t.slice(cut + 3) };
    }
    function armyLine() {
      var tx = el('army-line-text');
      if (!tx) return;
      var f = musterFaction(), a = armyText(f), td = f === 'rebel' && musterTactic() ? R.tacticById(musterTactic()) : null;
      tx.textContent = a.name + ' \u2014 ' + (td ? td.name : a.what);
    }
    function armyModal(on) {
      var m = el('army-modal');
      if (!m) return;
      m.hidden = !on;
      if (on) drawArmyModal();
    }
    function drawArmyModal() {
      var f = musterFaction();
      el('army-pick').innerHTML = HOT_FACTIONS.map(function (v) {
        var a = armyText(v);
        return '<button type="button" class="doc' + (v === f ? ' on' : '') + '" data-army-pick="' + v + '"><b>' + escHtml(a.name) + '</b>' +
          '<span>' + escHtml(a.what) + '</span></button>';
      }).join('');
      el('army-tactics').innerHTML = f !== 'rebel' ? '' : muster.solo
        ? '<p class="docnote">Rebel forces cannot use tactics in a solitaire or cooperative game: they get more composition points instead.</p>' :
        '<p class="docnote">A rebel force takes its tactic \u2014 Last Stand, Human Wave Attacks, Guerillas, or none \u2014 at the start of the ' +
        'battle, once the attacker and defender are known and before the terrain goes down. Build the list without it: ' +
        'Human Wave\u2019s extra infantry are called up then.</p>';
    }
    function pickInto(id, v) {
      var sel = el(id);
      if (!sel || sel.value === v) return;
      sel.value = v;
      sel.dispatchEvent(new Event('change'));
    }
    var colourHomeAt = null;
    function colourHome() {
      var cwp = el('colour-wrap');
      if (cwp && colourHomeAt && cwp.parentNode !== colourHomeAt.parent) colourHomeAt.parent.insertBefore(cwp, colourHomeAt.next);
      colourLabel();
    }
    function catModal(on) {
      var m = document.querySelector('#setup .muster.hot-force');   // the units, not the name panel
      if (m) m.classList.toggle('picking', !!on);
      if (el('cat-back')) el('cat-back').classList.toggle('open', !!on);
      if (on && el('cat')) el('cat').scrollTop = 0;
    }
    var tierHome = null;                 // where the Tier and Priority Level sit on the sheet, when not moved up for a demo
    function hotPaint() {
      var h = muster.hot, step = h.step, s = el('setup'), kind = h.kind;
      var force = kind === 'coop' || kind === 'solo' ? 'commando' : 'force';
      s.dataset.hot = String(step);
      s.dataset.kind = kind;
      if (hotQuick(kind)) s.dataset.quick = '1'; else delete s.dataset.quick;
      // set on the first force only: changing one force from the battlefield must not leave the other illegal
      ['sel-tier', 'sel-pl'].forEach(function (id) { if (el(id)) el(id).disabled = (step > 1 && !(hotQuick(kind) && step === 3)) || !!h.edit; });
      // solitaire and co-op: Priority Level 1 a player, fixed
      if ((kind === 'solo' || kind === 'coop') && el('sel-pl')) { el('sel-pl').value = '1'; el('sel-pl').disabled = true; }
      // a network game's terms are the host's, set in the room
      if (kind === 'net') ['sel-tier', 'sel-pl'].forEach(function (id) { if (el(id)) el(id).disabled = true; });
      // a demo sets the Tier and Priority Level for both forces, above them on the battlefield
      if (el('forcebar-wrap')) el('forcebar-wrap').classList.remove('open');   // a step on shuts the load-and-save list
      catModal(false);
      colourPop(false);
      armyModal(false);
      backLabel(el('btn-setup-back'), setupGoesHome());
      // the colours sit under the force's name, in the one panel
      var cwp = el('colour-wrap'), idp = document.querySelector('#setup .hot-name');
      if (cwp && idp && idp.appendChild && cwp.parentNode) { if (!colourHomeAt) colourHomeAt = { parent: cwp.parentNode, next: cwp.nextSibling }; idp.appendChild(cwp); }
      hotLabels();
      var fl = document.querySelector('label[for="sel-faction"]');
      if (fl) fl.textContent = kind === 'ai' && step === 2 ? 'Their force' : kind === 'demo' ? 'Kind of force' : 'Your force';
      var tp = el('tierpl-field');
      if (tp && tp.parentNode && el('hot-sum') && el('hot-sum').parentNode) {
        if (!tierHome) tierHome = { parent: tp.parentNode, next: tp.nextSibling };
        if (hotQuick(kind) && step === 3) el('hot-sum').parentNode.insertBefore(tp, el('hot-sum'));
        else if (tp.nextSibling !== tierHome.next) tierHome.parent.insertBefore(tp, tierHome.next);
      }
      el('setup-title').textContent = step === 3 ? 'The battlefield'
        : kind === 'solo' ? 'Muster your commando'
        : kind === 'net' ? 'Muster your force'
        : kind === 'build' ? 'Force builder \u2014 a skirmish force'
        : kind === 'ai' ? (step === 1 ? 'Muster your force' : 'The opposition \u2014 the AI\u2019s force')
        : hotWho(step) + ' \u2014 ' + (kind === 'demo' ? 'a force for the AI' : 'muster your ' + force);
      var intro = {
        hotseat: ['A hotseat battle: two players, one screen. Player 1 builds a force first and sets the Battle Tier and Priority Level; then Player 2 builds theirs, and then you choose where to fight.',
          ' is ready. Player 2 now builds a force of their own, at Battle Tier {T}, Priority Level {P}.',
          'A hotseat battle: two players, one screen. Set the Battle Tier and Priority Level, tap each player\u2019s force to muster it, then choose the scenario, the world and the table.'],
        coop: ['A co-operative game: two commandos, one each, against the OpFor. Player 1 builds a commando first, names it, paints it and sets the Battle Tier; then Player 2 does the same, in a colour of their own.',
          ' is ready. Player 2 now builds a commando of their own. The OpFor is rolled a Priority Level higher for the two of you.',
          'A co-operative game: two commandos against the OpFor. Set the Battle Tier and Priority Level, tap each player’s commando to muster it, then choose who you are up against, the solitaire scenario, the world and the table.'],
        solo: ['A solitaire game: your commando against the OpFor. Pick its units from the commando table.', '',
          'A solitaire game: your commando against the OpFor. Set the Battle Tier and Priority Level, tap your commando to muster it, then choose who you are up against, the solitaire scenario, the world and the table.'],
        ai: ['A battle against the AI. Build your force and set the Battle Tier and Priority Level; then choose what you are up against, and where.',
          ' is ready. Now the force the AI will command: it starts as a random kind of force with a rolled build \u2014 keep it, pick another kind to roll one of those, roll again, or build it by hand.',
          'Both forces are ready. Choose the scenario, the world and how the table is laid, then take the field.'],
        demo: ['A demo: two AI forces fight it out while you watch. Each starts as a random kind of force with a rolled build — keep it, change the kind, roll again or pick units by hand.',
          ' is ready. Now the force it will face.',
          'Both forces are ready. Choose the scenario, the world and how the table is laid, then watch.'],
        net: ['A game over the network: your force for ' + ((muster.forLobby && muster.forLobby.room) || 'the game') +
          ', at Battle Tier {T}, Priority Level {P}, as the host has set them. Name it, paint it and pick its units, then take it back to the table.', '', ''],
        build: ['A force to keep: pick its kind, the Battle Tier and Priority Level it is built for, and its units, then name it and save it ' +
          (root.PMCForces ? root.PMCForces.whereWords() : 'in this browser') +
          '. It is there to load from the saved forces whenever you muster a skirmish.', '', '']
      }[kind];
      /* Hotseat and co-op open on the battlefield with both forces rolled; a force is
         only ever opened from there, to change it (hotseat review HB-10). */
      if ((kind === 'hotseat' || kind === 'coop') && step < 3) {
        intro = intro.slice();
        intro[step - 1] = hotWho(step) + '\u2019s ' + (kind === 'coop' ? 'commando' : force) +
          ' for this battle, at Battle Tier {T}, Priority Level {P} (set on the battlefield). Pick its units, name it and paint it, then go back to the battlefield.' +
          (kind === 'coop' ? ' The OpFor is rolled a Priority Level higher for the two of you.' : '');
      }
      el('hot-intro').textContent = (step === 2 && kind !== 'hotseat' && kind !== 'coop' ? h.sides[0].name + intro[1] : intro[step - 1])
        .replace('{T}', R.ROMAN[musterTier()]).replace('{P}', musterPL());
      el('btn-start').textContent = kind === 'net' ? 'Back to the table' : kind === 'build' ? 'Save force'
        : step < 3 && h.edit ? 'Done'
        : step === 1 ? (kind === 'demo' ? 'Next: the second force' : kind === 'ai' ? 'Next: the opposition' : 'Next: Player 2\u2019s ' + force)
        : step === 2 ? 'Next: the battlefield' : kind === 'demo' ? 'Watch the battle' : 'Take the field';
      if (el('colour-hint')) el('colour-hint').textContent = step === 1 ? 'What ' + hotWho(1).replace(/^Your/, 'your') + '’s troops are painted in.'
          : 'What ' + hotWho(2).replace(/^The/, 'the') + '’s troops are painted in — anything but ' + hotWho(1).replace(/^Your/, 'your') + '’s colour.';
      if (step === 3) hotSum();
      drawColourPick();
    }
    /* The battlefield's forces, laid out as the campaign lobby's slots are: a
       line for each, with its colours on a chip (opening them by it), its name
       (tap it to muster the force: units, name and colours) and its army. A
       different army rolls the force again for it, at the Tier and Priority
       Level set above. A solitaire or co-op game has a line for the OpFor too:
       its army and its colours, the force itself rolled when the battle starts. */
    function hotCommando(kind) { return kind === 'coop' || kind === 'solo'; }
    // a line's colours: a force's own, or ('op') the OpFor's
    function hotColourOf(i) { var h = muster.hot; return i === 'op' ? h.opColour : h.sides[i] && h.sides[i].colour; }
    // the colours every other line wears, which this one cannot take
    function hotTaken(i) {
      var h = muster.hot, taken = [];
      h.sides.forEach(function (x, n) { if (x && n !== i) taken.push(x.colour); });
      if (hotCommando(h.kind) && i !== 'op' && h.opColour) taken.push(h.opColour);
      return taken;
    }
    function hotWhoOf(i) { return i === 'op' ? 'The OpFor' : hotWho(i + 1); }
    function hotSum() {
      var h = muster.hot, box = el('hot-sum');
      if (!h || !box) return;
      var cmd = hotCommando(h.kind), cf = h.colourFor;
      // the OpFor in a colour neither commando is wearing, kept so until it is changed
      if (cmd && (!h.opColour || hotTaken('op').indexOf(h.opColour) >= 0)) h.opColour = foeColour(hotTaken('op'));
      if (cf != null && !(cf === 'op' ? cmd : h.sides[cf])) cf = h.colourFor = null;
      box.classList.remove('two');
      var chipBtn = function (i) {
        var c = ISO.COLOURS[hotColourOf(i)];
        return U.chipButton('data-hotcolour="' + i + '" aria-label="' + escHtml(hotWhoOf(i)) + ' colours"', U.chip(hotColourOf(i)), cf === i, c ? c.name : 'Colours');
      };
      var armySel = function (i, want) {
        return U.armySelect('data-hotarmy="' + i + '" aria-label="' + escHtml(hotWhoOf(i)) + ' \u2014 army"', want);
      };
      /* A force rolled for the AI (or a demo's) is rolled to a personality: one picked
         here, or one at random (the default), named beside it once rolled. */
      var styleSel = function (sd, i) {
        var C = root.PMCCamp;
        if (cmd || !hotRolled(i + 1) || !C || !C.archetypesFor) return '';
        var all = C.archetypesFor(sd.faction).filter(function (a) { return a.faction === sd.faction || (!a.faction && sd.faction === 'pmc'); });
        if (!all.length) return '';
        var got = !sd.style && sd.keys && sd.keys.style && all.filter(function (a) { return a.id === sd.keys.style; })[0];
        var opt = function (v, t) { return '<option value="' + escHtml(v) + '"' + ((sd.style || '') === v ? ' selected' : '') + '>' + escHtml(t) + '</option>'; };
        return '<select data-hotstyle="' + i + '" aria-label="' + escHtml(hotWhoOf(i)) + ' \u2014 personality">' +
          opt('', 'Random' + (got ? ' (' + got.name + ')' : ' personality')) +
          all.map(function (a) { return opt(a.id, a.name); }).join('') + '</select>';
      };
      var html = '<div class="olob-slots">' + h.sides.map(function (sd, i) {
        var who = hotWho(i + 1);
        // a player's own force is theirs, as the lobby marks the slot you hold; a force rolled for the AI is not
        var mine = hotOwn(h.kind) && !(h.kind === 'ai' && i === 1);
        return '<div class="olob-slot' + (mine ? ' mine' : '') + '">' + chipBtn(i) +
          // the name opens the force, to pick its units; what it has so far is under it
          '<button type="button" class="olob-who hot-who" data-hotside="' + i + '"><b>' + escHtml(sd.name) + '</b>' +
          '<small>' + (sd.name === who ? '' : who + ' \u00b7 ') +
          (sd.keys.length ? sd.keys.length + ' units \u00b7 change' : 'no units yet \u2014 tap to muster it') + '</small></button>' +
          (styleSel(sd, i) ? '<span class="olob-sels">' + armySel(i, sd.faction) + styleSel(sd, i) + '</span>' : armySel(i, sd.faction)) + '</div>';
      }).join('');
      // the OpFor: its army drives the hidden "The OpFor" choice the battle reads
      if (cmd) {
        var opPL = musterPL() + (h.kind === 'coop' ? 1 : 0);
        html += '<div class="olob-slot">' + chipBtn('op') +
          '<span class="olob-who"><b>OpFor</b><small>rolled at Priority Level ' + opPL + '</small></span>' +
          armySel('op', el('sel-solo-op') ? el('sel-solo-op').value : 'rebel') + '</div>';
      }
      html += '</div>';
      // the colours of the line whose chip was tapped: those another line wears are not offered (each must be told apart)
      if (cf != null) {
        var taken = hotTaken(cf);
        html += U.colourPop('data-hotpop="' + cf + '"', hotColourOf(cf), function (k) {
          var off = taken.indexOf(k) >= 0;
          return { attrs: 'data-hotcol="' + k + '"', off: off, note: off ? ' \u2014 another force wears it' : '' };
        });
      }
      box.innerHTML = html;
      hotPlacePop();
    }
    // the colours sit fixed by their chip, as the lobby's do, and follow it as the sheet scrolls
    function hotPlacePop() {
      var pop = document.querySelector('#hot-sum .olob-pop'); if (!pop) return;
      var chip = document.querySelector('#hot-sum [data-hotcolour="' + pop.getAttribute('data-hotpop') + '"]');
      var sheet = el('setup') && el('setup').querySelector('.sheet');
      if (!chip || !sheet) return;
      var r = chip.getBoundingClientRect(), b = sheet.getBoundingClientRect(), w = Math.min(380, b.width - 16);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(b.left + 8, Math.min(r.left, b.right - w - 8)) + 'px';
      pop.style.top = (r.bottom + 6) + 'px';
    }
    // a line as its chip or select names it: a force's number, or 'op'
    function hotLine(v) { return v === 'op' ? 'op' : +v; }
    function hotColourFor(i) {
      var h = muster.hot;
      if (!h) return;
      h.colourFor = i;
      hotSum();
    }
    /* A force's name made up from its colours (the Jade Brood, Crimson company)
       follows a new colour or army; one a player typed stays. */
    function hotRename(sd, i) {
      var nm = sd.name || '';
      if (hotRolled(i + 1)) {
        if (nm && !isDemoName(nm) && !isMadeUpName(nm)) return;
        var other = muster.hot && muster.hot.sides && muster.hot.sides[1 - i];
        var pn = U.personaName(sd.keys, nm, other && other.name);
        if (pn) { sd.name = pn; return; }
        var list = DEMO_NOUNS[sd.faction] || DEMO_NOUNS.pmc;
        if (list.indexOf(sd.noun) < 0) sd.noun = list[Math.floor(Math.random() * list.length)];
        sd.name = demoName(sd.colour || 'ochre', sd.noun);
      } else if (isMadeUpName(nm)) {
        var other2 = muster.hot && muster.hot.sides && muster.hot.sides[1 - i];
        sd.name = U.forceName(sd.colour, sd.faction, sd.keys, nm, other2 && other2.name);
      }
    }
    function hotColour(i, k) {
      var h = muster.hot;
      if (!h || !ISO.COLOURS[k] || hotTaken(i).indexOf(k) >= 0) return;   // not another force's colours
      if (i === 'op') h.opColour = k;
      else if (h.sides[i]) { h.sides[i].colour = k; hotRename(h.sides[i], i); }
      h.colourFor = null;
      hotSum();
    }
    // another army for a force: a fresh build of that army, rolled at the Tier and Priority Level set above
    function hotArmy(i, f) {
      var h = muster.hot;
      if (!h || HOT_FACTIONS.indexOf(f) < 0) return;
      h.colourFor = null;
      if (i === 'op') { if (el('sel-solo-op')) el('sel-solo-op').value = f; hotSum(); return; }
      var sd = h.sides[i];
      if (!sd) return;
      sd.faction = f;
      sd.tactic = null;
      sd.style = null;   // another army's personalities: back to a random one
      sd.keys = hotCommando(h.kind) ? SOLO.rollCommando(musterTier(), musterPL(), f) : R.rollArmy(musterTier(), musterPL(), null, f);
      hotRename(sd, i);
      hotSum();
    }
    // a personality for a rolled force: rolled again to it ('' for one at random)
    function hotStyle(i, id) {
      var h = muster.hot, sd = h && h.sides[i];
      if (!sd || hotCommando(h.kind)) return;
      sd.style = id || null;
      sd.tactic = null;
      sd.keys = R.rollArmy(musterTier(), musterPL(), null, sd.faction, sd.style || undefined);
      hotRename(sd, i);
      hotSum();
    }
    function escHtml(t) { return R.esc(t); }
    function hotRefuse(why) {
      var f = el('faults');
      if (f) { f.textContent = why; f.className = 'faults'; if (f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return false;
    }
    function hotNext() {
      var h = muster.hot, who = hotWho(h.step);
      if (h.step < 3) {
        var name = ((el('hot-name') && el('hot-name').value) || '').trim() || muster.name;
        if (!name) {
          if (el('hot-name')) el('hot-name').focus();
          return hotRefuse(h.kind === 'ai' || h.kind === 'build' ? 'Give ' + who.toLowerCase() + ' a name.' : 'Give ' + who + '\u2019s ' + (h.kind === 'coop' ? 'commando' : 'force') + ' a name.');
        }
        var chk = musterCheck(muster.keys);
        if (!chk.ok) return hotRefuse((h.kind === 'ai' ? who : h.kind === 'build' ? 'This force' : who + '\u2019s ' + (h.kind === 'coop' ? 'commando' : 'force')) + ' is not legal yet: ' + (chk.faults.join(' ') || 'pick some units.'));
        var other = h.step === 2 ? h.sides[0] : h.edit ? h.sides[1] : null;
        if (other && name === other.name) return hotRefuse('The two need different names.');
        if (other && muster.colour === other.colour) return hotRefuse(who + ' needs a colour of ' + (h.kind === 'ai' ? 'its' : 'their') + ' own.');
        if (el('hot-name')) el('hot-name').value = name;
        hotSaveSide();
        // the force builder's: kept, under its name, and the builder stays open to make another
        if (h.kind === 'build') {
          var bf = currentForce(name);
          var told = function (r) {
            var fl = el('faults');
            if (!fl) return;
            fl.textContent = r.ok ? (r.replaced ? 'Replaced' : 'Saved') + ' \u201c' + name + '\u201d ' + (r.where === 'account' ? 'on your account' : 'in this browser') +
              ' \u2014 ' + bf.keys.length + ' units at Battle Tier ' + R.ROMAN[bf.tier] + ', Priority Level ' + bf.pl +
              '. Load it from the saved forces when you muster a skirmish.' : r.why;
            fl.className = 'faults' + (r.ok ? ' ok' : '');
            drawForceList();
          };
          if (root.PMCForces) root.PMCForces.save('skirmish', bf, told);
          else told({ ok: false, why: 'Saving is not available here.' });
          return;
        }
        // a network game's force goes back to the room it was built for
        if (h.kind === 'net') {
          var want = muster.forLobby, sd0 = h.sides[0];
          muster.forLobby = null;
          hotEnd();
          el('setup').hidden = true;
          if (want) want.done({ faction: sd0.faction, tactic: sd0.tactic || '', keys: sd0.keys.slice(), colour: sd0.colour, name: sd0.name });
          return;
        }
        if (h.edit) { h.edit = false; h.step = 3; hotPaint(); drawMuster(); el('setup').querySelector('.sheet').scrollTop = 0; return; }
        h.step++;
        if (h.step === 2) hotLoadSide(1);
        hotPaint(); drawMuster();
        el('setup').querySelector('.sheet').scrollTop = 0;
        return;
      }
      var a = h.sides[0], b = h.sides[1], tier = musterTier(), pl = musterPL();
      var commando = h.kind === 'coop' || h.kind === 'solo';
      if (commando) pl = 1;                            // each commando is Priority Level 1 (p. 147)
      // a force still to be mustered (or no longer legal): open it rather than take the field
      for (var si = 0; si < h.sides.length; si++) {
        var sd = h.sides[si];
        if (!sd) continue;
        if (!(commando ? SOLO.checkCommando(sd.keys, tier, pl, sd.faction) : R.checkArmy(sd.keys, tier, pl, null, sd.tactic, sd.faction)).ok) {
          hotEdit(si);
          return hotRefuse(sd.keys.length ? hotWho(si + 1) + ' is not legal yet.' : 'Muster ' + hotWho(si + 1).replace(/^Your/, 'your') + ' first.');
        }
      }
      var planet = el('sel-planet').value, terrainSetup = el('sel-terrain') && h.kind !== 'demo' ? el('sel-terrain').value : 'auto';
      if (commando) {
        // the commandos take the field as one side, each player's units their own
        var coop = h.kind === 'coop', armyA = [], ownersA = [];
        h.sides.forEach(function (sd, i) { sd.keys.forEach(function (k) { armyA.push(k); ownersA.push(i + 1); }); });
        var gamePL = pl + (coop ? 1 : 0), opFaction = el('sel-solo-op').value;
        // what the OpFor must be able to answer: the players' hulls, and their aircraft
        var machines = { ground: false, air: false };
        armyA.forEach(function (k) { var p = R.profile(R.splitPick(k).key); if (!p || p.cls === 'infantry') return; if (p.cls === 'aircraft') machines.air = true; else machines.ground = true; });
        var scen = el('sel-solo-scen').value;
        if (scen === 'roll') scen = SOLO.ORDER[Math.floor(Math.random() * SOLO.ORDER.length)];
        el('setup').hidden = true;
        hotEnd();
        begin({
          tier: tier, pl: gamePL, scenario: scen,
          armyA: armyA, armyB: SOLO.rollOpFor(tier, gamePL, opFaction, machines), ownersA: ownersA,
          nameA: coop ? a.name + ' & ' + b.name : a.name, nameB: 'OpFor',
          // each commando in its own colour; the OpFor in the one picked on its line (one neither is wearing)
          colourA: a.colour, colourC: coop ? b.colour : null,
          colourB: h.opColour && (coop ? [a.colour, b.colour] : [a.colour]).indexOf(h.opColour) < 0 ? h.opColour : foeColour(coop ? [a.colour, b.colour] : [a.colour]),
          tactics: { A: null, B: null }, mode: 'ai', planet: planet, terrainSetup: terrainSetup,
          solo: { coop: coop, faction: a.faction || 'pmc', opFaction: opFaction, names: coop ? [a.name, b.name] : [a.name] }
        });
        return;
      }
      var pickScen = el('sel-scen') ? el('sel-scen').value : 'secure';
      if (pickScen === 'roll') pickScen = SC.ORDER[R.d6() - 1];
      else if (pickScen === 'rolld3') pickScen = SC.ORDER[(d3Allowed() ? R.d3() : R.d6()) - 1];
      var mode = h.kind === 'demo' ? 'demo' : h.kind === 'ai' ? 'ai' : 'hotseat';
      el('setup').hidden = true;
      hotEnd();
      begin({
        tier: tier, pl: pl, scenario: pickScen,
        armyA: a.keys, armyB: b.keys, nameA: a.name, nameB: b.name,
        colourA: a.colour, colourB: b.colour,
        tactics: { A: a.tactic, B: b.tactic },
        // the personality each force was rolled to (R.rollArmy), for the AI's tactic and its temper in battle
        styles: { A: (a.keys && a.keys.style) || null, B: (b.keys && b.keys.style) || null },
        temper: { A: hotTemper(a), B: hotTemper(b) },
        mode: mode, planet: planet, terrainSetup: terrainSetup,
        secretSwaps: mode === 'hotseat'           // two players at one screen swap in turn, unseen
      });
    }
    function hotTemper(sd) {
      var C = root.PMCCamp, st = sd.keys && sd.keys.style;
      return st && C && C.aiTemper ? C.aiTemper({ archetype: st }) : null;
    }
    function hotBack() {
      var h = muster.hot;
      if (!h || h.step < 2) return;
      if (h.step === 2) hotSaveSide();          // keep what the second force had, for when they come back
      h.step--;
      hotLoadSide(h.step - 1);
      hotPaint(); drawMuster();
      el('setup').querySelector('.sheet').scrollTop = 0;
    }
    // a force picked from the battlefield step, to change before the battle
    function hotEdit(i) {
      var h = muster.hot;
      if (!h || h.step !== 3 || !h.sides[i]) return;
      h.edit = true; h.step = i + 1;
      hotLoadSide(i);
      hotPaint(); drawMuster();
      el('setup').querySelector('.sheet').scrollTop = 0;
    }
    /* The top bar's Back: out of a force being changed, back to the battlefield
       as it was; a step back through the forces; or, from the first step (or a
       demo's battlefield, where it started), the main menu. */
    // the top bar's button: a home icon when it goes to the main menu, "← Back" when it steps back a screen
    var HOME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
    function backLabel(btn, home) {
      if (!btn) return;
      btn.classList.toggle('home', !!home);
      btn.innerHTML = home ? HOME_ICON : '<span class="bk-ar" aria-hidden="true">\u2190</span><span class="bk-w"> Back</span>';
      btn.setAttribute('aria-label', home ? 'Main menu' : 'Back');
      btn.title = home ? 'Main menu' : 'Back';
    }
    window.PMC_BACK_LABEL = backLabel;
    function setupGoesHome() {
      var h = muster.hot;
      // a game picked from Single player or Hotseat goes back to that menu: Back, not home (the builder's to its own)
      if (h && /^(ai|solo|hotseat|coop|build)$/.test(h.kind || '')) return false;
      return !(h && h.edit) && !(h && h.step > 1 && !(h.step === 3 && h.from3));
    }
    function setupBack() {
      var h = muster.hot;
      if (muster.forLobby) {
        var was = muster.forLobby;
        muster.forLobby = null;
        hotEnd();
        el('setup').hidden = true;
        if (was.done) was.done(null);           // nothing changed: straight back to the room
        return;
      }
      if (h && h.edit) { h.edit = false; h.step = 3; hotPaint(); drawMuster(); return; }
      if (h && h.step > 1 && !(h.step === 3 && h.from3)) { hotBack(); return; }
      // up one level: to the menu the game was picked from
      openMenu(h && (h.kind === 'ai' || h.kind === 'solo') ? 'single' : h && (h.kind === 'hotseat' || h.kind === 'coop') ? 'hotseat' : h && h.kind === 'build' ? 'builder' : null);
    }

    return {
      ID_NOUN: ID_NOUN,
      applyForce: applyForce,
      backLabel: backLabel,
      colourPop: colourPop,
      currentForce: currentForce,
      demoRename: demoRename,
      drawForceList: drawForceList,
      drawMuster: drawMuster,
      escHtml: escHtml,
      hotBegin: hotBegin,
      hotEnd: hotEnd,
      hotLoadSide: hotLoadSide,
      hotPaint: hotPaint,
      hotQuick: hotQuick,
      hotSaveSide: hotSaveSide,
      isDemoName: isDemoName,
      isMadeUpName: isMadeUpName,
      loadForces: loadForces,
      muster: muster,
      musterFaction: musterFaction,
      musterTactic: musterTactic,
      saveCurrentForce: saveCurrentForce,
      setSoloMode: setSoloMode,
      setupGoesHome: setupGoesHome,
      wireMuster: wireMuster
    };
  };
})(window);
