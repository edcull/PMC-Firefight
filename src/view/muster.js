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
    var ISO = G.ISO, R = G.R, SC = G.SC, el = G.el, esc = G.esc, tip = G.tip, cam = G.cam;
    var begin = G.begin, openMenu = G.openMenu, colourLabel = G.colourLabel, drawColourPick = G.drawColourPick, foeColour = G.foeColour;

    var muster = { keys: [], name: '', solo: false };
    var SOLO = window.PMCSolo, SFX = window.SFX;

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
    function musterTactic() {
      if (musterFaction() !== 'rebel') return null;
      return (el('sel-tactic') && el('sel-tactic').value) || null;
    }

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
      var f = musterFaction();
      Array.prototype.forEach.call(sel.options, function (o) {
        var t = +o.value, txt;
        if (muster.solo && SOLO.COMMANDO && SOLO.COMMANDO[t]) {
          var cp = SOLO.COMMANDO[t].points;
          txt = cp[0] + ' points (' + cp[1] + ' for Rebels)';
        } else {
          var comp = f === 'bugs' && R.COMPOSITION_BUGS ? R.COMPOSITION_BUGS[t] : R.COMPOSITION[t];
          txt = (comp ? comp.points : t * 6) + ' points';
        }
        o.textContent = R.ROMAN[t] + ' \u2014 ' + txt;
      });
    }
    function drawMuster() {
      tierLabels();
      var tier = musterTier(), pl = musterPL(), faction = musterFaction(), tactic = musterTactic();
      var c = musterCheck(muster.keys);
      var lims = musterLimits(tier, pl, c);

      var tf = el('tactic-field');
      // Rebels cannot use Tactics in a solitaire game; they get the extra points instead (p. 147)
      if (tf) tf.hidden = faction !== 'rebel' || muster.solo;
      var mh = document.querySelector('.muster-head b');
      if (mh) mh.textContent = muster.hot && muster.hot.step < 3
        ? (muster.hot.kind === 'ai' || muster.hot.kind === 'solo' || muster.hot.kind === 'net' ? hotWho(muster.hot.step) : hotWho(muster.hot.step) + '\u2019s ' + (muster.solo ? 'commando' : 'force'))
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
      el('limits').innerHTML = (muster.solo ? 'Commando — ' : '') + [1, 2, 3, 4, 5].map(function (t) {
        var lo = lims[t - 1][0], hi = lims[t - 1][1];
        if (hi === 0) return null;
        var txt = hi === 99 ? lo + '+' : lo + '-' + hi;
        var short = c.counts[t] < lo || c.counts[t] > hi;
        return R.ROMAN[t] + ' <b' + (short ? ' class="short"' : '') + '>' + c.counts[t] + '/' + txt + '</b>';
      }).filter(Boolean).join(' · ');

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
        var mach = p.cls !== 'infantry';
        var st = [['Move', Math.floor(u0.move) + '"'], ['FP', u0.fp == null ? '\u2014' : u0.fp], ['Range', u0.range ? u0.range + '"' : '\u2014'],
          ['Def', u0.def], ['Asslt', u0.assault], mach ? ['Str', u0.str] : ['Men', pick.riders ? Math.ceil(u0.size / 2) : u0.size], mach ? null : ['Mor', u0.morale]].filter(Boolean);
        var TXT = window.PMCRuleText;
        return '<div class="fcard' + (freeIdx[i] ? ' free' : '') + '">' +
          '<div class="fcard-top"><span class="ct">' + R.ROMAN[p.tier] + '</span><b>' + esc(p.name) + (pick.riders ? ' (mounted)' : '') + '</b>' +
          '<span class="fcard-kind">' + esc(p.group || '') + '</span>' +
          (freeIdx[i] ? '<i class="freetag" title="Free: an extra unit from Human Wave Attacks">FREE</i>' : '') +
          drive + drone + ride + mnt +
          '<button type="button" class="lnk warn fcard-drop" data-drop="' + i + '" title="Remove" aria-label="Remove ' + esc(p.name) + '">\u2715</button></div>' +
          '<div class="fcard-stats">' + st.map(function (c2) { return '<span><i>' + c2[0] + '</i>' + esc(String(c2[1])) + '</span>'; }).join('') + '</div>' +
          ((u0.rules || []).length ? '<div class="fcard-rules">' + u0.rules.map(function (r) {
            var d = TXT ? TXT.describe(r) : { name: r, text: '' };
            return '<span class="mk" ' + tip(d.name, d.text || '') + '>' + esc(d.name) + '</span>';
          }).join('') + '</div>' : '') + '</div>';
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
          return '<button type="button" class="cu" data-add="' + p.key + '"' + (ok ? '' : ' disabled') +
            ' title="' + why + '">' +
            '<span class="t">' + R.ROMAN[p.tier] + '</span>' +
            '<span>' + p.name + '<small>' + statLine(p) + (p.rules.length ? ' · ' + p.rules.join(', ') : '') + '</small></span>' +
            '<span class="st">+' + p.tier + '</span></button>';
        }).join('');
      }).join('');

      var sel = el('sel-preset');
      var want = muster.solo ? [] : R.presetsFor(tier, faction);
      sel.innerHTML = '<option value="">Ready-made…</option>' + want.map(function (pr) {
        return '<option value="' + pr.id + '">' + pr.name + '</option>';
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

    function drawForceList() {
      var sel = el('sel-force');
      if (!sel) return;
      var list = loadForces();
      var cur = sel.value;
      sel.innerHTML = '<option value="">' +
        (list.length ? 'Saved forces…' : 'No saved forces yet') + '</option>' +
        list.map(function (f, i) {
          var sub = R.ROMAN[f.tier] + '/' + f.pl + ' · ' + f.keys.length + ' units';
          return '<option value="' + i + '">' + esc(f.name) + ' — ' + sub + '</option>';
        }).join('');
      if (cur && list[cur]) sel.value = cur;
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

    function wireMuster() {
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
              sd.keys = cmd ? SOLO.rollCommando(musterTier(), musterPL(), sd.faction) : R.rollArmy(musterTier(), musterPL(), null, sd.faction);
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
            if (!nm || isMadeUpName(nm)) { muster.name = (ISO.COLOURS[muster.colour] ? ISO.COLOURS[muster.colour].name + ' ' : '') + FORCE_NOUN[musterFaction()]; if (hn) hn.value = muster.name; }
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
      el('sel-preset').addEventListener('change', function () {
        var pr = R.presetsFor(musterTier(), musterFaction()).filter(function (x) { return x.id === el('sel-preset').value; })[0];
        if (!pr) return;
        muster.keys = pr.keys.slice();
        muster.name = pr.name;
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
            muster.name = '';
          }
        } else if (b.getAttribute('data-army') === 'roll' && muster.solo) {
          muster.keys = SOLO.rollCommando(musterTier(), musterPL(), musterFaction());
          muster.name = 'Commando';
        } else if (b.getAttribute('data-army') === 'roll') {
          muster.keys = R.rollArmy(musterTier(), musterPL(), null, musterFaction());
          muster.name = 'Battle Tier ' + R.ROMAN[musterTier()] +
            (musterFaction() === 'rebel' ? ' insurgent group' : musterFaction() === 'bugs' ? ' swarm' : musterFaction() === 'xeno' ? ' tribe' : ' company');
        } else { muster.keys = []; muster.name = ''; }
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
          var f = loadForces()[parseInt(sel.value, 10)];
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
      if (el('btn-demo-saves-done')) el('btn-demo-saves-done').addEventListener('click', function () { saves.classList.remove('open'); });
      if (saves) saves.addEventListener('click', function (ev) { if (ev.target === saves) saves.classList.remove('open'); });
      if (el('hot-sum')) el('hot-sum').addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-hotside]');
        if (b) hotEdit(+b.getAttribute('data-hotside'));
      });
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
    var FORCE_NOUN = { pmc: 'company', rebel: 'insurgents', bugs: 'swarm', xeno: 'tribe' };
    var FORCE_KIND = { pmc: 'Mercenary company', rebel: 'Insurgent group', bugs: 'Bug swarm', xeno: 'Xenotripod tribe' };
    function hotWho(step) {
      var k = muster.hot.kind;
      if (k === 'ai') return step === 1 ? 'Your force' : 'The opposition';
      if (k === 'solo') return 'Your commando';
      if (k === 'net') return 'Your force';
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
    function hotOwn(kind) { return kind === 'ai' || kind === 'hotseat' || kind === 'coop' || kind === 'solo' || kind === 'net'; }
    /* 'net': a network game's own force, built on the same sheet as a skirmish's
       but on its own — the other player builds theirs on their own screen, and
       the Tier and Priority Level are the host's. */
    function hotBegin(kind) {
      muster.hot = { kind: kind, step: 1, sides: kind === 'solo' || kind === 'net' ? [null] : [null, null] };
      muster.keys = []; muster.name = '';
      if (el('hot-name')) el('hot-name').value = '';
      if (kind === 'demo') hotRandomise(0);
      else if (hotOwn(kind)) {
        // the player's force starts empty, in desert ochre, as "Your force" (or Player 1's) until they name it
        muster.colour = 'ochre';
        el('sel-faction').value = 'pmc';             // a mercenary company, until they pick another kind
        drawColourPick();
        if (el('sel-tactic')) el('sel-tactic').value = '';
        muster.name = kind === 'hotseat' || kind === 'coop' ? 'Player 1' : kind === 'solo' ? 'Your commando' : 'Your Force';
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
      muster.keys = muster.solo ? SOLO.rollCommando(musterTier(), musterPL(), f) : R.rollArmy(musterTier(), musterPL(), null, f);
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
      muster.name = (ISO.COLOURS[muster.colour] ? ISO.COLOURS[muster.colour].name + ' ' : '') + FORCE_NOUN[f];
      if (el('hot-name')) el('hot-name').value = muster.name;
    }
    // "The Jade Brood": a name made up from a colour, the way a demo force is named
    function isDemoName(n) {
      return ISO.COLOUR_KEYS.some(function (k) { return n.indexOf(demoName(k, '')) === 0; });
    }
    function isMadeUpName(n) {
      return ISO.COLOUR_KEYS.some(function (k) {
        return HOT_FACTIONS.some(function (f) { return n === ISO.COLOURS[k].name + ' ' + FORCE_NOUN[f]; });
      });
    }
    function hotSaveSide() {
      var i = muster.hot.step - 1;
      muster.hot.sides[i] = {
        keys: muster.keys.slice(), faction: musterFaction(), tactic: muster.solo ? null : musterTactic(),
        name: ((el('hot-name') && el('hot-name').value) || '').trim() || muster.name || '',
        colour: muster.colour || 'ochre', noun: muster.demoNoun || null
      };
    }
    function hotLoadSide(i) {
      var sd = muster.hot.sides[i];
      if (sd) {
        muster.keys = sd.keys.slice(); muster.name = sd.name; muster.colour = sd.colour; muster.demoNoun = sd.noun || null;
        el('sel-faction').value = sd.faction;
        if (el('sel-tactic')) el('sel-tactic').value = sd.tactic || '';
        if (el('hot-name')) el('hot-name').value = sd.name;
      } else if (hotRolled(i + 1)) {
        if (el('hot-name')) el('hot-name').value = '';   // a fresh force: the other one's name is not its own
        hotRandomise(i);
      } else {
        // a fresh force for the second player, in a colour the first is not wearing
        var two = i === 1 && (muster.hot.kind === 'hotseat' || muster.hot.kind === 'coop');
        muster.keys = []; muster.name = two ? 'Player 2' : '';
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
      var chip = el('colour-btn-chip'), cc = ISO.COLOURS[muster.colour];
      if (chip && cc) chip.style.background = 'linear-gradient(135deg,' + cc.light + ' 0 38%,' + cc.mid + ' 38% 74%,' + cc.dark + ' 74%)';
      if (el('btn-colour-pop') && cc) el('btn-colour-pop').title = 'Colours: ' + cc.name;
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
      var f = musterFaction(), tac = musterTactic() || '';
      el('army-pick').innerHTML = HOT_FACTIONS.map(function (v) {
        var a = armyText(v);
        return '<button type="button" class="doc' + (v === f ? ' on' : '') + '" data-army-pick="' + v + '"><b>' + escHtml(a.name) + '</b>' +
          '<span>' + escHtml(a.what) + '</span></button>';
      }).join('');
      el('army-tactics').innerHTML = f !== 'rebel' ? '' :
        '<h4>Rebel tactic \u2014 chosen before the terrain goes down</h4><div class="docpick">' +
        [{ id: '', name: 'No tactic', text: 'A rebel force may take one tactic, or none.' }].concat(R.TACTICS).map(function (t) {
          return '<button type="button" class="doc' + (t.id === tac ? ' on' : '') + '" data-tactic-pick="' + t.id + '"><b>' + escHtml(t.name) + '</b>' +
            (t.short ? '<i>' + escHtml(t.short) + '</i>' : '') + '<span>' + escHtml(t.text) + '</span></button>';
        }).join('') + '</div>';
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
      var chip = el('colour-btn-chip'), cc = ISO.COLOURS[muster.colour];
      if (chip && cc) chip.style.background = 'linear-gradient(135deg,' + cc.light + ' 0 38%,' + cc.mid + ' 38% 74%,' + cc.dark + ' 74%)';
      if (el('btn-colour-pop') && cc) el('btn-colour-pop').title = 'Colours: ' + cc.name;
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
          ', at Battle Tier {T}, Priority Level {P}, as the host has set them. Name it, paint it and pick its units, then take it back to the table.', '', '']
      }[kind];
      el('hot-intro').textContent = (step === 2 ? h.sides[0].name + intro[1] : intro[step - 1])
        .replace('{T}', R.ROMAN[musterTier()]).replace('{P}', musterPL());
      el('btn-start').textContent = kind === 'net' ? 'Back to the table'
        : step < 3 && h.edit ? 'Back to the battlefield'
        : step === 1 ? (kind === 'demo' ? 'Next: the second force' : kind === 'ai' ? 'Next: the opposition' : 'Next: Player 2\u2019s ' + force)
        : step === 2 ? 'Next: the battlefield' : kind === 'demo' ? 'Watch the battle' : 'Take the field';
      if (el('colour-hint')) el('colour-hint').textContent = step === 1 ? 'What ' + hotWho(1).replace(/^Your/, 'your') + '’s troops are painted in.'
          : 'What ' + hotWho(2).replace(/^The/, 'the') + '’s troops are painted in — anything but ' + hotWho(1).replace(/^Your/, 'your') + '’s colour.';
      if (step === 3) {
        // each force is a button: tap it to go back and change it
        el('hot-sum').innerHTML = h.sides.map(function (sd, i) {
          var c = ISO.COLOURS[sd.colour] || {};
          return '<button type="button" class="hot-side" data-hotside="' + i + '"><b style="color:' + (c.light || 'inherit') + '">' + escHtml(sd.name) + '</b>' +
            '<em>change</em>' +
            '<small>' + hotWho(i + 1) + ' · ' + (FORCE_KIND[sd.faction] || sd.faction) + ' · ' +
            (sd.keys.length ? sd.keys.length + ' units' : 'no units yet \u2014 tap to muster it') +
            (sd.tactic ? ' · ' + escHtml(R.tacticById(sd.tactic).name) : '') + '</small></button>';
        }).join('');
      }
      drawColourPick();
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
          return hotRefuse(h.kind === 'ai' ? 'Give ' + who.toLowerCase() + ' a name.' : 'Give ' + who + '\u2019s ' + (h.kind === 'coop' ? 'commando' : 'force') + ' a name.');
        }
        var chk = musterCheck(muster.keys);
        if (!chk.ok) return hotRefuse((h.kind === 'ai' ? who : who + '\u2019s ' + (h.kind === 'coop' ? 'commando' : 'force')) + ' is not legal yet: ' + (chk.faults.join(' ') || 'pick some units.'));
        var other = h.step === 2 ? h.sides[0] : h.edit ? h.sides[1] : null;
        if (other && name === other.name) return hotRefuse('The two need different names.');
        if (other && muster.colour === other.colour) return hotRefuse(who + ' needs a colour of ' + (h.kind === 'ai' ? 'its' : 'their') + ' own.');
        if (el('hot-name')) el('hot-name').value = name;
        hotSaveSide();
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
        var machines = armyA.some(function (k) { var p = R.profile(R.splitPick(k).key); return p && p.cls !== 'infantry'; });
        var scen = el('sel-solo-scen').value;
        if (scen === 'roll') scen = SOLO.ORDER[Math.floor(Math.random() * SOLO.ORDER.length)];
        el('setup').hidden = true;
        hotEnd();
        begin({
          tier: tier, pl: gamePL, scenario: scen,
          armyA: armyA, armyB: SOLO.rollOpFor(tier, gamePL, opFaction, machines), ownersA: ownersA,
          nameA: coop ? a.name + ' & ' + b.name : a.name, nameB: 'OpFor',
          // each commando in its own colour; the OpFor in one neither is wearing
          colourA: a.colour, colourC: coop ? b.colour : null, colourB: foeColour(coop ? [a.colour, b.colour] : [a.colour]),
          tactics: { A: null, B: null }, mode: 'ai', planet: planet, terrainSetup: terrainSetup,
          solo: { coop: coop, faction: a.faction || 'pmc', opFaction: opFaction, names: coop ? [a.name, b.name] : [a.name] }
        });
        return;
      }
      var pickScen = el('sel-scen') ? el('sel-scen').value : 'secure';
      if (pickScen === 'roll') pickScen = SC.ORDER[R.d6() - 1];
      else if (pickScen === 'rolld3') pickScen = SC.ORDER[R.d3() - 1];
      var mode = h.kind === 'demo' ? 'demo' : h.kind === 'ai' ? 'ai' : 'hotseat';
      el('setup').hidden = true;
      hotEnd();
      begin({
        tier: tier, pl: pl, scenario: pickScen,
        armyA: a.keys, armyB: b.keys, nameA: a.name, nameB: b.name,
        colourA: a.colour, colourB: b.colour,
        tactics: { A: a.tactic, B: b.tactic },
        mode: mode, planet: planet, terrainSetup: terrainSetup,
        secretSwaps: mode === 'hotseat'           // two players at one screen swap in turn, unseen
      });
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
      btn.innerHTML = home ? HOME_ICON : '\u2190 Back';
      btn.setAttribute('aria-label', home ? 'Main menu' : 'Back');
      btn.title = home ? 'Main menu' : 'Back';
    }
    window.PMC_BACK_LABEL = backLabel;
    function setupGoesHome() {
      var h = muster.hot;
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
      openMenu();
    }
    window.__hot = function () { return muster.hot ? JSON.parse(JSON.stringify(muster.hot)) : null; };
    window.__cam = function () { return { x: cam.x, y: cam.y, z: cam.z, borrowed: !!cam.borrowed, home: cam.home ? { x: cam.home.x, y: cam.home.y } : null }; };

    return {
      FORCE_NOUN: FORCE_NOUN,
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
