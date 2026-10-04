/* PMC 2670 — Firefight : founding a force: the second player, colours, the pickers and the founding sheet

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierFound = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, esc = E.esc, profile = E.profile, root = E.root,
        tierChip = E.tierChip;
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
    /* Online: the player's own force, on their own side, founded on their own
       device (dossier-online.js) — whichever side the campaign gave them. */
    function beginOwn(side, faction) {
      var other = E.camp.companies[side === 'A' ? 'B' : 'A'];
      var co = C.newCompany('', { faction: faction || 'pmc' });
      E.camp.companies[side] = co;
      if (side === 'B') { E.camp.rivals = [co]; E.camp.facing = 0; }
      var taken = other && other.roster && other.roster.length ? [other.colour] : [];
      E.draft = { side: side, keys: [], doctrine: null, name: '', colour: co.faction === 'bugs' && taken.indexOf('olive') < 0 ? 'olive' : taken.length ? freeColour(taken) : startingColour(co.faction) };
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
      return '<span class="cflash" title="' + esc(c.name) + '" style="background:' + root.PMCUi.fill(c) + '"></span>';
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
        return root.PMCUi.swatch('type="button"' + (k === pick ? ' class="on"' : '') + ' data-campcolour="' + k + '" title="' + esc(c.name) + '"', c);
      }).join('') + '</div>';
    }
    function colourName(k) {
      var CO = (root.PMCIso && root.PMCIso.COLOURS) || {};
      return CO[k] ? CO[k].name : 'Choose a colour';
    }
    /* A list opened over the page (the founding screen's pickers, the hub's
       rivals): drawn with the page, hidden unless open, so a pick made in it
       redraws it along with everything else. */
    /* A window over the page: its title across the top and a close on the right
       (a tap outside it closes it too); under it, any action of its own (the
       filters' Clear). */
    function cmodal(kind, title, inner, acts) {
      return '<div class="cmodal" data-modal="' + kind + '"' + (E.openModal === kind ? '' : ' hidden') + '>' +
        '<div class="cmodal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="cmodal-head"><h3>' + esc(title) + '</h3>' +
        '<button type="button" class="xclose" data-go="fmodalclose" title="Close" aria-label="Close">\u2715</button></div>' + inner +
        (acts ? '<div class="askrow">' + acts + '</div>' : '') + '</div></div>';
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
      // a hotseat campaign kept as a world on this device: whose force it is, by the player at the screen
      var lw = E.online && E.online.local && root.PMCLocalWorld ? root.PMCLocalWorld.playerName(root.PMCLocalWorld.seat(E.online.id)) + ' \u2014 ' : '';
      var h = '<h2>' + lw + (hot ? 'Player ' + (side === 'A' ? 1 : 2) + ' \u2014 ' : '') +
        say('Found a company', 'Raise a revolt', 'Awaken a swarm', 'Claim a territory') + '</h2>';
      // online, the army and the colours were picked in the campaign's lobby: nothing to choose here
      if (E.online) {
        h += '';
      } else if (hot && side === 'B') {
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
        '<div class="name-row"><' + (E.online ? 'span class="chip-btn still"' : 'button type="button" class="chip-btn" data-go="fcolour" aria-expanded="' + E.colourOpen + '"') +
        ' title="' + esc('Colours: ' + colourName(E.draft.colour)) + '"><span' + (cc ? ' style="background:' + root.PMCUi.fill(cc) + '"' : '') + '></span></' + (E.online ? 'span' : 'button') + '>' +
        '<input class="tin" id="found-name" maxlength="28" autocomplete="off"' +
        ' placeholder="' + say('e.g. Task Force Ironhold', 'e.g. The Free Colonies', 'e.g. The Hive', 'e.g. The Ghadon Third') + '"' +
        ' value="' + esc(E.draft.name || '') + '"></div></div>' +
        // the colours a square each, as the unit viewer has them, dropped down under the chip
        (E.colourOpen && !E.online ? '<div class="found-pop"><label>' + say('Company colours', 'Colours of the revolt', 'Colour of the swarm\u2019s shells', 'The light in the tribe\u2019s armour') +
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
          driveButton(p, s, i) + droneButton(p, s, i) + rideButtons(p, s, i) + '</span>';
      }).join('');
      /* On the page, each unit picked is a card: its name and kind, its Tier, its
         numbers and its special rules, with its drive and its remove button. The
         list scrolls when there are more than fit. */
      var cards = E.draft.keys.map(function (k, i) {
        var sp = R.splitPick(k), p0 = profile(sp.key);
        var u0 = R.applyDrone(R.applyPropulsion(Object.assign({}, p0, { rules: (p0.rules || []).slice(), models: p0.size }), sp.prop || R.defaultDrive(p0)), !!sp.drone);
        u0 = R.applyRiders(u0, sp.riders);
        if (R.canMount(p0, sp.riders)) R.applyMount(u0, sp.mount || 'none');
        var mach = p0.cls !== 'infantry';
        // the muster's shorthand, with the numbers as fielded
        var line = root.PMC_STAT_SHORT ? root.PMC_STAT_SHORT(u0) : '';
        return '<div class="fcard">' +
          '<div class="fcard-top">' + tierChip(p0.tier) + '<b>' + esc(p0.name) + '</b>' +
          '<span class="fcard-kind">' + esc(p0.group || (mach ? p0.cls : 'Infantry')) + '</span>' +
          driveButton(p0, sp, i) + droneButton(p0, sp, i) +
          rideButtons(p0, sp, i) +
          '<button class="lnk danger fcard-drop" data-drop="' + i + '" title="Remove" aria-label="Remove ' + esc(p0.name) + '">\u2715</button></div>' +
          '<div class="fcard-line">' + esc(line) + '</div>' +
          root.PMCUi.ruleMarks(u0.rules) +
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
      if (!(hot && side === 'B') || E.online) h += '<p class="camp-foot"><button class="lnk" data-go="foundback">Back</button></p>';
      return h;
    }

    /* What a unit rides: the Riders upgrade where it may take it (Holy Warriors,
       First Among Equals), and a motorbike, grav bike or horse for anyone who
       rides — the Mounted Warriors always, the others once mounted. */
    /* A ground vehicle's propulsion: its icon, opening the drives it may take
       in a list beside it; and Drone Control, an icon (crew or drone) that
       flips on a tap. */
    var SVG = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var HULL = '<path d="M3 12h18v-2.5L18 6H8L5 9.5H3z"/>';
    var DRIVE_ICON = {
      none: SVG('<path d="M3 14h18v-3l-3-4H8l-3 4H3z"/><path d="M3 14v3h18v-3"/>'),
      wheeled: SVG(HULL + '<circle cx="7.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'),
      tracked: SVG('<path d="M5 9h14l-2-3H7z"/><rect x="2.5" y="11" width="19" height="7.5" rx="3.75"/><circle cx="7" cy="14.75" r="1.3"/><circle cx="12" cy="14.75" r="1.3"/><circle cx="17" cy="14.75" r="1.3"/>'),
      grav: SVG(HULL + '<path d="M6 15.5h12M8 18.5h8M10.5 21.5h3"/>'),
      hover: SVG(HULL + '<path d="M3 13.5h18l-2.5 3.5h-13z"/><path d="M7 20.5l-1 1M12 20v1.5M17 20.5l1 1"/>'),
      walker: SVG('<path d="M5 6h14v5H5z"/><path d="M8 11l-2.5 5 2.5 5.5M16 11l2.5 5-2.5 5.5"/>')
    };
    var CREW_ICON = SVG('<circle cx="12" cy="8" r="3.6"/><path d="M8.6 6.6c.6-2 1.8-3 3.4-3s2.8 1 3.4 3"/><path d="M4.5 21c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8"/>');
    var DRONE_ICON = SVG('<rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9.5 10.5 6.5 7.5M14.5 10.5l3-3M9.5 13.5l-3 3M14.5 13.5l3 3"/><circle cx="5.5" cy="6.5" r="2.3"/><circle cx="18.5" cy="6.5" r="2.3"/><circle cx="5.5" cy="17.5" r="2.3"/><circle cx="18.5" cy="17.5" r="2.3"/>');
    function driveButton(p, s, i) {
      var props = R.propsFor(p);
      if (!props.length) return '';
      var now = s.prop || 'none', P = R.PROPULSION[now], open = E.propFor === i;
      var h = '<span class="fdrive"><button type="button" class="drive dicon' + (open ? ' on' : '') + '" data-fprop="' + i + '" aria-expanded="' + open +
        '" title="' + esc(P.name + ' \u2014 ' + P.note) + '" aria-label="Propulsion: ' + esc(P.name) + '">' + DRIVE_ICON[now] + '</button>';
      if (open) {
        h += '<div class="found-pop propop" role="listbox"><label>Propulsion</label>' + props.map(function (k) {
          var Q = R.PROPULSION[k];
          return '<button type="button" class="propopt' + (k === now ? ' on' : '') + '" role="option" aria-selected="' + (k === now) + '" data-fpropset="' + i + '" data-prop="' + k + '">' +
            DRIVE_ICON[k] + '<span><b>' + esc(Q.name) + '</b><small>' + esc(Q.note) + '</small></span></button>';
        }).join('') + '</div>';
      }
      return h + '</span>';
    }
    function droneButton(p, s, i) {
      if (!R.canBeDrone(p)) return '';
      return '<button type="button" class="drive dicon' + (s.drone ? ' on' : '') + '" data-fdrone="' + i + '" aria-pressed="' + !!s.drone + '" title="' +
        (s.drone ? 'Drone Control: +1 Structure, no crew, never earns experience \u2014 but Hackers can reach it. Tap for a crew.'
          : 'Crewed. Tap for Drone Control: +1 Structure, no crew, never earns experience \u2014 but Hackers can reach it.') +
        '" aria-label="' + (s.drone ? 'Drone Control' : 'Crewed') + '">' + (s.drone ? DRONE_ICON : CREW_ICON) + '</button>';
    }
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
          // its numbers and special rules, as the skirmish muster's list gives them
          h += root.PMCUi.unitRow('class="cu" data-add="' + p.key + '"', p.tier, '<b>' + esc(p.name) + '</b>',
            esc(statLine(p) + ((p.rules || []).length ? ' · ' + p.rules.join(', ') : '')), null);
        });
      });
      return h;
    }
    // the skirmish muster's shorthand (8 models · M5 · FP4 · 18" · Def 11 · A4 · Mor 5), the one card format everywhere
    function statLine(p) {
      if (root.PMC_STAT_SHORT) return root.PMC_STAT_SHORT(p);
      if (p.cls === 'infantry') {
        return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
          ' · Assault ' + p.assault + ' · Morale ' + p.morale;
      }
      return 'Move ' + p.move + '"' + (p.turn != null ? ' (' + p.turn + ')' : '') + ' · ' + (p.fp == null ? 'Assault only' : 'FP ' + p.fp + ' · Range ' + p.range + '"') + ' · Def ' + p.def +
        ' · Assault ' + p.assault + ' · Structure ' + p.str;
    }

    return {
      beginFounding: beginFounding, needsSecond: needsSecond, beginSecond: beginSecond, beginOwn: beginOwn,
      startingColour: startingColour, colourFlash: colourFlash, colourOf: colourOf, freeColour: freeColour,
      squares: squares, colourName: colourName, cmodal: cmodal, coin: coin, foundView: foundView,
      ourList: ourList, statLine: statLine
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierFound;
})(typeof window !== 'undefined' ? window : global);
