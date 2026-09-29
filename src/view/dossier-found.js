/* PMC 2670 — Firefight : founding a force: the second player, colours, the pickers and the founding sheet

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierFound = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, esc = E.esc, profile = E.profile, root = E.root,
        tierChip = E.tierChip, tip = E.tip;
    /* ================= founding ================= */
    function beginFounding(name, mode, faction) {
      E.camp = C.newCampaign({
        mode: mode, nameA: name, nameB: rivalName(),
        factionA: faction || 'pmc', factionB: faction || 'pmc'
      });
      /* The name and the colours are settled on the founding screen, alongside the
         units — they are the three things that make a company yours, and asking
         for them in one place is how a player thinks about it. */
      E.draft = { side: 'A', keys: [], doctrine: null, name: name, colour: startingColour(faction) };
      E.view = 'found';
    }
    /* Hotseat: the second player founds a force of their own on the same screen,
       once the first has signed — their own army, name, colours, units and
       doctrine. Until they have, the campaign waits for them, even across a
       reload. */
    function needsSecond() {
      return !!(E.camp && E.camp.mode === 'hotseat' && E.camp.companies.A.roster.length &&
        !(E.camp.companies.B && E.camp.companies.B.roster.length));
    }
    function beginSecond(faction) {
      var A = E.camp.companies.A;
      var B = C.newCompany('', { faction: faction || (E.camp.companies.B && E.camp.companies.B.faction) || A.faction });
      E.camp.companies.B = B; E.camp.rivals = [B]; E.camp.facing = 0;
      E.draft = { side: 'B', keys: [], doctrine: null, name: '', colour: B.faction === 'bugs' && A.colour !== 'olive' ? 'olive' : freeColour([A.colour]) };
      E.view = 'found';
    }
    var FACTION_CHOICES = [['pmc', 'A private military company'], ['rebel', 'An insurgent revolt'],
      ['bugs', 'A Space Bug swarm'], ['xeno', 'A Xenotripod tribe']];
    // the colour the player last painted a force in, or the house ochre
    function startingColour(faction) {
      var c = null;
      try { c = localStorage.getItem('pmc-colour'); } catch (e) { }
      // a swarm's shells are olive drab unless a colour has been chosen before
      return (root.PMCIso && root.PMCIso.COLOURS[c]) ? c : faction === 'bugs' ? 'olive' : 'ochre';
    }
    function colourKeys() {
      return (root.PMCIso && root.PMCIso.COLOUR_KEYS) || ['ochre'];
    }
    // a small bar of a force's colours, to sit beside its name
    function colourFlash(co) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
      var c = CO[colourOf(co)];
      if (!c) return '';
      return '<span class="cflash" title="' + esc(c.name) + '" style="background:linear-gradient(135deg,' +
        c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span>';
    }
    function colourOf(co) {
      var k = co && co.colour;
      return (root.PMCIso && root.PMCIso.COLOURS[k]) ? k : 'ochre';
    }
    // a colour for the opposition: anything the player is not already wearing
    function freeColour(taken) {
      var free = colourKeys().filter(function (k) { return (taken || []).indexOf(k) < 0; });
      if (!free.length) free = colourKeys();
      return free[Math.floor(Math.random() * free.length)];
    }
    // a swatch row, as used on the founding screen
    function squares(pick) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
      return '<div class="csw">' + colourKeys().map(function (k) {
        var c = CO[k];
        return '<button type="button"' + (k === pick ? ' class="on"' : '') + ' data-campcolour="' + k + '" title="' + esc(c.name) + '">' +
          '<span style="background:linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)"></span></button>';
      }).join('') + '</div>';
    }
    function colourName(k) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
      return CO[k] ? CO[k].name : 'Choose a colour';
    }
    /* A list opened over the page (the founding screen's pickers, the hub's
       rivals): drawn with the page, hidden unless open, so a pick made in it
       redraws it along with everything else. */
    function cmodal(kind, title, inner, foot) {
      return '<div class="cmodal" data-modal="' + kind + '"' + (E.openModal === kind ? '' : ' hidden') + '>' +
        '<div class="cmodal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<h3>' + esc(title) + '</h3>' + inner +
        '<div class="askrow">' + (foot || '') + '<button type="button" class="start" data-go="fmodalclose">Done</button></div></div></div>';
    }
    function rivalName() { return 'Rival company'; }
    // what this campaign calls its money, and what its creed is called
    function coin() { return C.money(E.camp && E.camp.companies ? E.camp.companies.A : null); }

    function foundView() {
      var side = E.draft.side || 'A', co = E.camp.companies[side];
      var hot = E.camp.mode === 'hotseat';
      var t1 = 0, t2 = 0, machines = 0;
      E.draft.keys.forEach(function (k) {
        var p = profile(R.splitPick(k).key);
        if (p.tier === 1) t1++; else if (p.tier === 2) t2++;
        if (p.cls !== 'infantry') machines++;
      });
      var reb = co.faction === 'rebel', bug = co.faction === 'bugs', xen = co.faction === 'xeno';
      function say(pmc, rebel, bugs, xeno) { return xen ? (xeno || bugs) : bug ? bugs : reb ? rebel : pmc; }
      var h = '<h2>' + (hot ? 'Player ' + (side === 'A' ? 1 : 2) + ' \u2014 ' : '') +
        say('Found a company', 'Raise a revolt', 'Awaken a swarm', 'Claim a territory') + '</h2>';
      if (hot && side === 'B') {
        /* The second player picks their own kind of force: the first player's
           choice on the hub only ever named the first force. */
        h += '<p class="lede">' + esc(E.camp.companies.A.name) + ' has signed. Now the other force on this world \u2014 yours.</p>' +
          '<div class="field"><label>What you are running</label><div class="docpick facpick">' +
          FACTION_CHOICES.map(function (f) {
            return '<button class="doc' + (co.faction === f[0] ? ' on' : '') + '" data-bfaction="' + f[0] + '"><b>' + esc(f[1]) + '</b></button>';
          }).join('') + '</div></div>';
      }
      /* Who you are, before what you field: the name it will be known by and the
         colours it paints its kit in. The opposition takes a colour of its own
         from whatever is left, so no two forces on a table ever match. */
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {}, cc = CO[E.draft.colour];
      h += '<div class="muster foundid found-id">' +
        // no label over it: the chip and the box speak for themselves (it stays for screen readers)
        '<div class="field"><label for="found-name" class="sr-only">' +
        say('Company name', 'What the revolt calls itself', 'What the swarm is known as', 'What the tribe is known as') + '</label>' +
        // the colour picked, a chip left of the name: tap it for the colours
        '<div class="name-row"><button type="button" class="chip-btn" data-go="fcolour" aria-expanded="' + E.colourOpen + '"' +
        ' title="' + esc('Colours: ' + colourName(E.draft.colour)) + '"><span' + (cc ? ' style="background:linear-gradient(135deg,' +
        cc.light + ' 0 38%,' + cc.mid + ' 38% 74%,' + cc.dark + ' 74%)"' : '') + '></span></button>' +
        '<input class="tin" id="found-name" maxlength="28" autocomplete="off"' +
        ' placeholder="' + say('e.g. Task Force Ironhold', 'e.g. The Free Colonies', 'e.g. The Hive', 'e.g. The Ghadon Third') + '"' +
        ' value="' + esc(E.draft.name || '') + '"></div></div>' +
        // the colours a square each, as the unit viewer has them, dropped down under the chip
        (E.colourOpen ? '<div class="found-pop"><label>' + say('Company colours', 'Colours of the revolt', 'Colour of the swarm\u2019s shells', 'The light in the tribe\u2019s armour') +
          ' \u2014 ' + esc(colourName(E.draft.colour)) + '</label>' + squares(E.draft.colour) + '</div>' : '') +
        '</div>';
      // the kind of force leads the list: its pill, which opens the army's rules
      var head = '<div class="muster-head">' + E.armyPill(co, 'armyfound') +
        '<span class="pts' + (t1 === 6 && t2 === 2 ? '' : ' over') + '">' +
        t1 + '/6 Tier I · ' + t2 + '/2 Tier II · ' + machines + ' vehicle' + (machines === 1 ? '' : 's') + ' (max 2)</span></div>';
      var chosen = E.draft.keys.map(function (k, i) {
        var s = R.splitPick(k), p = profile(s.key);
        return '<span class="pickwrap"><button class="pick" data-drop="' + i + '">' +
          esc(p.name) + ' <b>' + ROMAN[p.tier] + '</b></button>' +
          (R.propsFor(p).length ? '<button class="drive" data-cycle="' + i + '">' +
            R.PROPULSION[s.prop || 'none'].short + '</button>' : '') +
          (R.canBeDrone(p) ? '<button class="drive' + (s.drone ? ' on' : '') + '" data-fdrone="' + i +
            '" title="Drone Control: +1 Structure, no crew, never earns experience — but Hackers can reach it">' +
            (s.drone ? 'DRN' : 'crew') + '</button>' : '') + rideButtons(p, s, i) + '</span>';
      }).join('');
      /* On the page, each unit picked is a card: its name and kind, its Tier, its
         numbers and its special rules, with its drive and its remove button. The
         list scrolls when there are more than fit. */
      var TXT = root.PMCRuleText;
      var cards = E.draft.keys.map(function (k, i) {
        var sp = R.splitPick(k), p0 = profile(sp.key);
        var u0 = R.applyDrone(R.applyPropulsion(Object.assign({}, p0, { rules: (p0.rules || []).slice(), models: p0.size }), sp.prop || R.defaultDrive(p0)), !!sp.drone);
        u0 = R.applyRiders(u0, sp.riders);
        if (R.canMount(p0, sp.riders)) R.applyMount(u0, sp.mount || 'none');
        var mach = p0.cls !== 'infantry';
        var st = [['Move', u0.move + '"'], ['FP', u0.fp == null ? '\u2014' : u0.fp], ['Range', u0.range ? u0.range + '"' : '\u2014'],
          ['Def', u0.def], ['Asslt', u0.assault], mach ? ['Str', u0.str] : ['Men', u0.size], mach ? null : ['Mor', u0.morale]].filter(Boolean);
        return '<div class="fcard">' +
          '<div class="fcard-top">' + tierChip(p0.tier) + '<b>' + esc(p0.name) + '</b>' +
          '<span class="fcard-kind">' + esc(p0.group || (mach ? p0.cls : 'Infantry')) + '</span>' +
          (R.propsFor(p0).length ? '<button class="drive" data-cycle="' + i + '">' + R.PROPULSION[sp.prop || 'none'].short + '</button>' : '') +
          (R.canBeDrone(p0) ? '<button class="drive' + (sp.drone ? ' on' : '') + '" data-fdrone="' + i +
            '" title="Drone Control: +1 Structure, no crew, never earns experience — but Hackers can reach it">' + (sp.drone ? 'DRN' : 'crew') + '</button>' : '') +
          rideButtons(p0, sp, i) +
          '<button class="lnk warn fcard-drop" data-drop="' + i + '" title="Remove" aria-label="Remove ' + esc(p0.name) + '">\u2715</button></div>' +
          '<div class="fcard-stats">' + st.map(function (c) { return '<span><i>' + c[0] + '</i>' + esc(c[1]) + '</span>'; }).join('') + '</div>' +
          ((u0.rules || []).length ? '<div class="fcard-rules">' + u0.rules.map(function (r) {
            var d = TXT ? TXT.describe(r) : { name: r, text: '' };
            return '<span class="mk" ' + tip(d.name, d.text || '') + '>' + esc(d.name) + '</span>';
          }).join('') + '</div>' : '') +
          '</div>';
      }).join('');
      // under the list, side by side: the units to add, and the starting doctrine
      var cr = C.creedOf(co), doc = E.draft.doctrine && C.doctrine(E.draft.doctrine);
      h += '<div class="muster found-units">' + head +
        '<div class="chosen fcards" id="found-chosen">' + cards + '</div>' +
        '<div class="found-row">' +
        '<button type="button" class="lnk" data-go="fmodal" data-kind="units">+ Add units</button>' +
        '<button type="button" class="lnk' + (doc ? ' on' : '') + '" data-go="fmodal" data-kind="doctrine" title="Starting ' + cr.one + '">' +
        (doc ? esc(doc.name) : 'Choose ' + (bug ? 'an ' : 'a ') + cr.one) + '</button></div></div>';

      // the three pickers, each a modal over the page
      // the army's rules, from its pill
      h += cmodal('armyfound', C.words(co).side + ' \u2014 army rules', E.armyRules(co));
      h += cmodal('units', say('The company', 'The revolt', 'The swarm', 'The tribe'),
        head + '<div class="chosen">' + chosen + '</div>' +
        '<div class="cat cmodal-scroll" id="found-cat">' + catalogueFor(1, 2, function (p) {
          // a Tier II machine cannot be fielded in the Tier I battles a new force starts in
          return !p.leaderBug && !p.alpha && !(p.tier === 2 && p.cls !== 'infantry');
        }, co) + '</div>');
      // the doctrines in their groups, each under its own heading
      var docGroups = [], byCat = {};
      cr.list.forEach(function (d) {
        if (!byCat[d.cat]) { byCat[d.cat] = []; docGroups.push(d.cat); }
        byCat[d.cat].push(d);
      });
      h += cmodal('doctrine', 'Starting ' + cr.one, '<div class="cmodal-scroll">' + docGroups.map(function (cat) {
        return '<h4 class="docgroup">' + esc(say(cat, 'Path of the ' + cat, cat + ' Pathway', cat + ' Advancement')) + '</h4>' +
          '<div class="docpick">' + byCat[cat].map(function (d) {
            return '<button class="doc' + (E.draft.doctrine === d.id ? ' on' : '') + '" data-doc="' + d.id + '">' +
              '<b>' + esc(d.name) + '</b><span>' + esc(d.text) + '</span></button>';
          }).join('') + '</div>';
      }).join('') + '</div>');

      var named = !!(E.draft.name || '').trim();
      var rest = !!(t1 === 6 && t2 === 2 && machines <= 2 && E.draft.doctrine);
      var chk = { ok: rest && named };
      var readyTxt = xen ? 'Ready. The Alpha squad joins free, at the Tribe Tier, and grows with it.'
        : bug ? 'Ready. The Leader Bug joins free, at the Swarm Tier, and grows with it.'
        : reb ? 'Ready. The First Among Equals who started it joins free, at the Revolt Tier.'
        : 'Ready. The field command is added free, at the Company Tier.';
      var nameTxt = say('The company needs a name.', 'The revolt needs a name.', 'The swarm needs a name.', 'The tribe needs a name.');
      /* No line of help under it: what the charter still wants is on the
         button, in the game's own tip — on a hover, and on a press while it is
         greyed out (aria-disabled rather than disabled, so the press arrives).
         The name is typed without a redraw, so the button follows it as it is
         typed (see mount). */
      var why = chk.ok ? readyTxt : rest && !named ? nameTxt
        : 'Six Tier I units, two Tier II, at most two vehicles, one ' + cr.one + '.' + (named ? '' : ' ' + nameTxt);
      h += '<button class="start" id="found-sign" data-rest="' + (rest ? 1 : 0) + '" data-go="dofound"' +
        ' data-tip="' + esc(why) + '" data-tip-title="' + (chk.ok ? 'Ready' : 'Still needed') + '"' +
        ' data-ready="' + esc(readyTxt) + '" data-noname="' + esc(nameTxt) + '" aria-disabled="' + !chk.ok + '">' +
        say('Sign the charter', 'Raise the banner', 'Wake the hive', 'Claim the ground') + '</button>';
      // the second player cannot step back out: the campaign needs their force
      // back to choosing what to run: the force is not founded yet, so there is nothing to keep
      if (!(hot && side === 'B')) h += '<p class="camp-foot"><button class="lnk" data-go="foundback">Back</button></p>';
      return h;
    }

    /* What a unit rides: the Riders upgrade where it may take it (Holy Warriors,
       First Among Equals), and a motorbike, grav bike or horse for anyone who
       rides — the Mounted Warriors always, the others once mounted. */
    function rideButtons(p, s, i) {
      var h = '';
      if (R.canRide(p)) h += '<button class="drive' + (s.riders ? ' on' : '') + '" data-friders="' + i +
        '" title="Riders upgrade: half the models, Movement 10, and the Riders rule">' + (s.riders ? 'RDR' : 'foot') + '</button>';
      if (R.canMount(p, s.riders)) h += '<button class="drive" data-fmount="' + i +
        '" title="What they ride: a motorbike, a grav bike (no terrain penalties, \u22121 Defence) or a horse (crosses walls, +1 SP when shot at)">' +
        esc(MOUNT_SHORT[s.mount || 'none']) + '</button>';
      return h;
    }
    var MOUNT_SHORT = { none: 'No mount', bike: 'Motorbike', gravbike: 'Grav bike', horse: 'Horse' };

    // which list a force recruits from — a company only ever hires its own kind
    function ourList(co) {
      var a = co || (E.camp && E.camp.companies ? E.camp.companies.A : null);
      return R.listFor((a && a.faction) || 'pmc');
    }

    /* the catalogue, limited to the Tiers a screen allows */
    function catalogueFor(minTier, maxTier, filter, co) {
      var groups = {}, order = [];
      ourList(co).forEach(function (p) {
        if (p.tier < minTier || p.tier > maxTier) return;
        if (p.command) return;                       // the field command is free and fixed
        // turrets and insertion platforms are never bought: they are fielded with a contract's force
        if (C.isTurretP(p) || p.noSlot) return;
        if (filter && !filter(p)) return;
        if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
        groups[p.group].push(p);
      });
      var h = '';
      order.forEach(function (g) {
        h += '<h4>' + esc(g) + '</h4>';
        groups[g].forEach(function (p) {
          h += '<button class="cu" data-add="' + p.key + '">' +
            '<span class="t">' + ROMAN[p.tier] + '</span>' +
            '<span><b>' + esc(p.name) + '</b><small>' + esc(statLine(p)) + '</small></span>' +
            '<span class="st">' + (p.cls === 'infantry' ? p.size + ' men' : p.cls) + '</span></button>';
        });
      });
      return h;
    }
    function statLine(p) {
      if (p.cls === 'infantry') {
        return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
          ' · Assault ' + p.assault + ' · Morale ' + p.morale;
      }
      return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
        ' · Assault ' + p.assault + ' · Structure ' + p.str;
    }

    return {
      beginFounding: beginFounding, needsSecond: needsSecond, beginSecond: beginSecond,
      startingColour: startingColour, colourFlash: colourFlash, colourOf: colourOf, freeColour: freeColour,
      squares: squares, colourName: colourName, cmodal: cmodal, coin: coin, foundView: foundView,
      ourList: ourList, statLine: statLine
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierFound;
})(typeof window !== 'undefined' ? window : global);
