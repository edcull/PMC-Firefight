/* PMC 2670 — Firefight : the dossier: the roster, a unit's details, the memorial, spending experience and recruiting

   Made once by dossier.js, the first time it is wanted. E is what it needs
   of dossier.js: what never changes bound here once, and what does (the
   campaign, the contract, which screen is open) read through E as it is
   now. It hands back the functions below. */
(function (root) {
  'use strict';
  root.PMCDossierRoster = function (E) {
    var C = E.C, R = E.R, ROMAN = E.ROMAN, entryCard = E.entryCard, esc = E.esc, ourList = E.ourList,
        profile = E.profile, root = E.root, save = E.save, statLine = E.statLine;
    /* ================= the dossier ================= */
    var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    var ICON_RENAME = SVG + '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';          // a pencil
    var ICON_DISBAND = SVG + '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>';   // a bin
    var ICON_PROMOTE = SVG + '<path d="M6 14l6-6 6 6"/><path d="M6 20l6-6 6 6"/></svg>';                    // chevrons up
    function rosterBody(co) {
      var h = '';
      if (E.rosterTab === 'units') {
        // every unit on the books has its soldiers named; an old save gets them now
        var named = false;
        co.roster.forEach(function (e) { if (C.menOf(e, co)) named = true; });
        if (named) save();
        var fk = co === E.camp.companies.B && E.camp.mode === 'hotseat' ? 'B' : co === E.camp.companies.A ? 'A' : 'B', shown = co.roster.filter(function (e) { return E.unitPasses(e, fk); });
        h += '<div class="dlist">';
        if (!shown.length) h += '<p class="cpstat">No unit has any yet.</p>';
        // your own force: as the sort and filter line above the list says
        var ordered = fk === 'A' ? E.dossierOrder(shown) : shown.slice().sort(function (a, b) {
          // the command first — it earns no experience and carries no honours or traumas — then by Tier and experience
          var la = C.isLeaderP(profile(a.key)) ? 1 : 0, lb = C.isLeaderP(profile(b.key)) ? 1 : 0;
          return lb - la || profile(b.key).tier - profile(a.key).tier || b.exp - a.exp;
        });
        if (shown.length && !ordered.length) h += '<p class="cpstat">No unit matches the filter.</p>';
        var at = {};
        ordered.forEach(function (e) {
          if (fk === 'A') h += E.groupHead(e, at);
          // on a phone each is its icon alone, so the three sit on one row
          var acts = '<button class="lnk dact" data-rename="' + e.rid + '" title="Rename" aria-label="Rename">' + ICON_RENAME + '<span>Rename</span></button>';
          var open = !!E.menOpen[e.rid];
          // enough experience for something: a Promote button, opening the choices in a window
          var spend = canSpend(e, co) ? '<button class="lnk good dact" data-promo="' + e.rid + '" title="Promote" aria-label="Promote">' + ICON_PROMOTE + '<span>Promote</span></button>' : '';
          var dis = C.canDisband(co, e);
          acts += '<button class="lnk danger dact" data-disband="' + e.rid + '" aria-label="Disband"' + (dis.ok ? ' title="Disband"' : ' disabled title="' + esc(dis.why) + '"') + '>' + ICON_DISBAND + '<span>Disband</span></button>';
          if (spend) acts += spend;
          // closed, a card offers only Promote (when there is the experience for it); opened, all of them
          h += entryCard(e, co, { actions: open ? acts : spend, men: open ? detailPanel(e, co) : '', expand: true, portrait: open, rowActs: true, mark: true });
        });
        h += '</div>';
      } else if (E.rosterTab === 'spend') {
        h += spendList(co);
      } else {
        h += recruitList(co);
      }
      return h;
    }
    /* On the hub the dossier takes the place of the Tier panel, in the same
       box: its tabs across the top and the list scrolling under them. */
    function dossierPanel(co) {
      // the recruiting list fills the panel and scrolls itself; the others scroll the panel
      /* At its foot, the way in to recruiting; while recruiting, the same
         button goes back to the units, and says so. */
      var rec = E.rosterTab === 'recruit';
      var foot = '<div class="cdos-foot"><button class="lnk' + (rec ? ' on' : '') + '" data-rtab="' + (rec ? 'units' : 'recruit') + '" aria-pressed="' + rec + '">' +
        (rec ? '\u2190 Back to the dossier' : '+ ' + esc(C.words(co).recruit)) + '</button></div>';
      return '<div class="cprom cdos"><div class="cprom-list cdos-body' + (rec ? ' cdos-fill' : '') + '">' + rosterBody(co) + '</div>' + foot + '</div>';
    }
    /* Every soldier the force has lost in the campaign, most recent battle
       first: who they were, what they served in, and where they fell. */
    /* The loss rate: every model lost against every model that has ever served,
       replacements included. */
    /* The loss rate: everything lost against everything that has ever served,
       replacements included — soldiers, the tribe's warriors, or the swarm's
       biomass. */
    function lossLine(co) {
      return C.lossStats(co).map(function (st) {
        if (!st.served) return '';
        // penal troopers are counted apart, and not in the loss rate
        if (st.countOnly) return st.lost ? '<div class="dloss"><b>' + st.lost + '</b> ' + st.unit + ' killed <span>not counted as losses</span></div>' : '';
        var pct = Math.round(st.pct * 1000) / 10, wpct = Math.round(st.wpct * 1000) / 10, W = C.fateWords(co, st.pool);
        // the swarm's is biomass, and a bug is not wounded: it is lost or it is not
        if (st.pool === 'biomass') return '<div class="dloss"><b>' + pct + '%</b> lost <span>' + st.lost + ' of ' + st.served + ' ' + st.unit + '</span></div>';
        return '<div class="dloss"><b>' + pct + '%</b> ' + W.kia + ' <b class="wia">' + wpct + '%</b> ' + W.wia + ' <span>' + st.lost + ' ' + W.kia + ', ' +
          st.wounded + ' ' + W.wia + ', of ' + st.served + ' ' + st.unit + '</span></div>';
      }).join('');
    }
    function memorialList(co) {
      if (co.faction === 'bugs') return biomassList(co);
      // (a drone squad's losses were put on it by older saves: they were never anyone)
      var list = (co.memorial || []).filter(function (m) {
        var p = R.CATALOGUE.filter(function (q) { return q.name === m.type; })[0];
        return !p || !(p.group === 'Drones' || (p.rules || []).indexOf('Drone unit') >= 0);
      });
      if (!list.length) return lossLine(co) + '<p class="dnote">No one has been ' + (co.faction === 'xeno' ? 'lost to the hunt' : 'killed or wounded') + ' yet.</p>';
      var W = C.words(co);
      // killed or wounded; an entry from before the roll was made is one of the dead
      function tag(kia, w) { w = w || W; return '<span class="dfate ' + (kia ? 'kia' : 'wia') + '">' + (kia ? w.kiaTag : w.wiaTag) + '</span>'; }
      // the Tier an entry was lost at; one from before it was kept is read off the profile by name
      function tierOf(m) {
        if (m.tier) return m.tier;
        var p = R.CATALOGUE.filter(function (q) { return q.name === m.type; })[0];
        return p && p.tier;
      }
      var WA = C.fateWords(co, 'eshaven');     // the unnamed are the Esh-Aven, or penal troopers: killed or wounded
      var SCx = root.PMCScen, battles = {}, order = [];
      list.forEach(function (m) {
        if (!battles[m.battle]) { battles[m.battle] = []; order.push(m.battle); }
        battles[m.battle].push(m);
      });
      order.sort(function (a, b) { return b - a; });
      var h = lossLine(co);
      /* The unnamed dead of one kind (penal troopers, the Esh-Aven) are one line
         for the battle, however many squads of them fell. */
      function mergeAnon(ms) {
        var out = [], seen = {};
        ms.forEach(function (m) {
          if (!m.anon) { out.push(m); return; }
          var key = m.type + '|' + (m.noun || '');
          var k = m.kia != null ? m.kia : m.count || 0, w = m.wounded || 0;
          if (seen[key]) { seen[key].count += m.count || 0; seen[key].kia += k; seen[key].wounded += w; seen[key].squads++; return; }
          seen[key] = { anon: true, type: m.type, noun: m.noun, count: m.count || 0, kia: k, wounded: w, squads: 1, unit: m.unit, tier: m.tier };
          out.push(seen[key]);
        });
        return out;
      }
      /* The named are gathered under their unit, a line each for killed or
         wounded, rank and name; the unit's line carries its Tier. The unnamed
         (penal troopers, the Esh-Aven) stay one line of counts for the kind. */
      function rows(ms) {
        var dot = '<i class="dmem-dot"> \u00b7 </i>', groups = [], byUnit = {};
        ms.forEach(function (m) {
          if (m.anon) { groups.push({ anon: m }); return; }
          // one group a unit — by which roster unit it was, where that was kept — named as it was: its own name and its type, or the type
          var key = m.rid || (m.unit || m.type);
          if (!byUnit[key]) {
            var own = m.unit && m.type && m.unit !== m.type;
            byUnit[key] = { unit: m.unit || m.type, type: own ? m.type : null, tier: tierOf(m), list: [] };
            groups.push(byUnit[key]);
          }
          byUnit[key].list.push(m);
        });
        return groups.map(function (g) {
          if (g.anon) {
            var m = g.anon, tier = tierOf(m);
            var tail = (tier ? dot + '<span class="dmem-tier">Tier ' + ROMAN[tier] + '</span>' : '') +
              dot + '<span class="dmem-unit">' + (m.squads > 1 ? m.squads + ' squads' : esc(m.unit || m.type)) + '</span>';
            return '<li>' + (m.kia ? tag(true, WA) + ' ' + m.kia : '') + (m.kia && m.wounded ? ' ' : '') +
              (m.wounded ? tag(false, WA) + ' ' + m.wounded : '') + dot + '<b>' + esc(m.noun || 'Esh-Aven') + '</b>' + tail + '</li>';
          }
          return '<li class="dmem-grp"><span class="dmem-unit">' + esc(g.unit) + '</span>' +
            (g.type ? dot + '<span class="dmem-type">' + esc(g.type) + '</span>' : '') +
            (g.tier ? dot + '<span class="dmem-tier">Tier ' + ROMAN[g.tier] + '</span>' : '') + '</li>' +
            g.list.map(function (m) {
              return '<li class="dmem-in">' + tag(m.fate !== 'wounded') + dot + '<span class="dmem-rank">' + esc(m.rank) + '</span>' + dot +
                '<b>' + esc(m.name) + '</b></li>';
            }).join('');
        }).join('');
      }
      order.forEach(function (n) {
        var ms = mergeAnon(battles[n]), first = battles[n][0];
        var sc = SCx && SCx.SCENARIOS && SCx.SCENARIOS[first.scenario];
        h += '<div class="dmem"><div class="dmem-head">Campaign turn ' + n +
          (first.against ? ' · against ' + esc(first.against) : '') + (sc ? ' · ' + esc(sc.name) : '') +
          '<span class="mk">' + ms.reduce(function (k, m) { return k + (m.count || 1); }, 0) + '</span></div><ol class="dmem-list">' +
          rows(ms) + '</ol></div>';
      });
      return h;
    }
    /* The swarm mourns no one: its memorial is the biomass it has spent over
       the campaign, totalled for each kind of bug. */
    function biomassList(co) {
      var bio = C.biomassTally(co), types = Object.keys(bio);
      if (!types.length) return lossLine(co) + '<p class="dnote">No biomass lost yet.</p>';
      types.sort(function (a, b) { return bio[b].mass - bio[a].mass || bio[b].models - bio[a].models || (a < b ? -1 : 1); });
      var total = types.reduce(function (n, t) { return n + bio[t].mass; }, 0);
      return lossLine(co) +
        '<div class="dmem"><div class="dmem-head">Biomass lost<span class="mk">' + total + '</span></div>' +
        '<ol class="dmem-list">' + types.map(function (t) {
          return '<li class="dmem-bio"><b>' + esc(t) + '</b><span class="dmen-rank">\u00d7 ' + bio[t].models +
            (bio[t].mass ? ' \u00b7 ' + bio[t].mass + ' biomass' : ' \u00b7 not biomass') + '</span></li>';
        }).join('') + '</ol></div>';
    }

    /* Everything about one unit, opened from its card: the profile as it takes
       the field — honours, traumas, upgrades and doctrines already worked in, with
       what they changed marked — its special rules spelled out, what it has
       earned and suffered, and its soldiers by name. The unit is built the way
       the battle builds it, so these are the numbers it will fight with. */
    function detailPanel(e, co) {
      var p = profile(e.key);
      if (!p) return '';
      var base = Object.assign({}, p, { rules: (p.rules || []).slice(), models: p.size, side: 'A', cargo: [] });
      base = R.applyDrone(R.applyPropulsion(base, e.prop || R.defaultDrive(p)), !!e.drone);
      var riding = !!e.riders && R.canRide(p);
      base = R.applyRiders(base, riding);
      if (R.canMount(p, riding)) R.applyMount(base, e.mount || 'none');
      var was = Object.assign({}, base, { rules: base.rules.slice() });
      var u = C.applyEntry(Object.assign({}, base, { rules: base.rules.slice() }), e, co.doctrines || []);
      var mach = p.cls !== 'infantry';
      function cell(label, now, then, fmt) {
        var v = now == null ? '\u2014' : fmt ? fmt(now) : now, d = now != null && then != null ? now - then : 0;
        return { label: label, v: v, d: d };
      }
      var inch = function (n) { return n + '"'; };
      // the same names and order as the muster's line: Men (a machine's Str), Move, FP, Range, Def, Asslt, Mor
      // (its Tier is on the card's chip: not repeated here, so the row fits a phone)
      var cols = [mach ? cell('Str', u.str, was.str) : cell('Men', u.size, was.size),
        cell('Move', u.move, was.move, inch), cell('FP', u.fp, was.fp), cell('Range', u.range || null, was.range || null, inch),
        cell('Def', u.def, was.def), cell('Asslt', u.assault, was.assault)];
      if (!mach) cols.push(cell('Mor', u.morale, was.morale));
      if (u.turn != null) cols.push(cell('Turn', u.turn, was.turn));
      var h = '<div class="ddet">';
      h += '<table class="ddet-stats"><tr>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') +
        '</tr><tr>' + cols.map(function (c) {
          return '<td' + (c.d ? ' class="' + (c.d > 0 ? 'up' : 'down') + '"' : '') + '>' + esc(c.v) +
            (c.d ? '<sup>' + (c.d > 0 ? '+' : '') + c.d + '</sup>' : '') + '</td>';
        }).join('') + '</tr></table>';
      if (u.defPierced != null) h += '<p class="ddet-note">Defence ' + u.defPierced + ' against Anti-tank and Gauss weapons.</p>';
      /* What it rides: the Riders upgrade, "decided when that unit is recruited. The
         decision is final" (p. 97) — so shown fixed, chosen on the recruiting list;
         and a motorbike, grav bike or horse once it rides. */
      if (R.canRide(p) || R.canMount(p, riding)) {
        h += '<h5>Mounted</h5><div class="ddet-ride">';
        if (R.canRide(p)) h += '<span class="ddet-fixed" title="Chosen when the unit was recruited, and final (p. 97)">' +
          (riding ? 'Mounted (Riders)' : 'On foot') + ' \u2014 fixed</span>';
        if (R.canMount(p, riding)) h += R.MOUNT_ORDER.map(function (m) {
          return '<button class="lnk' + ((e.mount || 'none') === m ? ' on' : '') + '" data-emount="' + e.rid + '" data-m="' + m + '" title="' +
            esc(R.MOUNTS[m].note) + '">' + esc(R.MOUNTS[m].name) + '</button>';
        }).join('');
        h += '</div>';
      }

      var TXT = root.PMCRuleText;
      h += '<h5>Special rules</h5>';
      if (!u.rules.length) h += '<p class="ddet-note">None.</p>';
      else {
        h += '<ul class="ddet-rules">' + u.rules.map(function (r) {
          var d = TXT ? TXT.describe(r) : { name: r, text: '' };
          return '<li><b>' + esc(d.name) + '</b>' +
            (d.text ? '<span>' + esc(d.text) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }
      function marks(title, list, table, cls) {
        if (!list || !list.length) return '';
        return '<h5>' + esc(title) + '</h5><ul class="ddet-rules">' + list.map(function (n) {
          var x = table[n - 1] || { name: '#' + n, text: '' };
          return '<li class="' + cls + '"><b>' + esc(x.name) + '</b><span>' + esc(x.text || '') + '</span></li>';
        }).join('') + '</ul>';
      }
      var W = C.words(co);
      h += marks(W.honours, e.honours, C.honourTable(e.key), 'good');
      h += marks('Upgrades', e.upgrades, C.upgradeTable(e.key), 'good');
      h += marks(W.traumas, e.traumas, C.traumaTable(e.key), 'bad');
      if (!C.isLeaderP(p) && !(e.honours || []).length && !(e.traumas || []).length && !(e.upgrades || []).length) {
        h += '<p class="ddet-note">No ' + esc(W.honours) + ' or ' + esc(W.traumas) + ' yet.</p>';
      }
      if ((e.men || []).length) h += '<h5>' + (mach ? 'Crew' : 'Soldiers') + ' (' + e.men.length + ')</h5>' + menPanel(e);
      return h + '</div>';
    }

    // the soldiers of one unit, by rank and name, each of them renameable
    function menPanel(e) {
      return '<ol class="dmen">' + (e.men || []).map(function (m, i) {
        return '<li><span class="dmen-rank">' + esc(m.rank) + '</span>' +
          '<b class="dmen-name">' + esc(m.name) + '</b>' +
          '<button class="lnk dact" data-rsoldier="' + e.rid + '" data-i="' + i + '" title="Rename" aria-label="Rename">' + ICON_RENAME + '<span>Rename</span></button></li>';
      }).join('') + '</ol>';
    }

    /* What a unit can spend its experience on: a promotion to each unit it may
       become, and an honour (or an upgrade, for a machine). */
    function spendActs(e, co) {
      var p = profile(e.key);
      if (C.isLeaderP(p)) return '';
      if ((p.rules || []).indexOf('Turret') >= 0) return '';            // turrets never earn EXP
      var acts = '';
        C.promotionTargets(e, co).forEach(function (q) {
          var c = C.promotionCost(e, q.key);
          var can = e.exp >= c.exp && co.kUC >= c.kUC;
          acts += '<button class="lnk" data-promote="' + e.rid + '" data-to="' + q.key + '"' +
            (can ? '' : ' disabled') + '>→ ' + esc(q.name) + ' · ' + c.exp + ' EXP' +
            (c.kUC ? ' + ' + c.kUC + ' ' + C.money(co) : '') +
            // what it becomes: its Tier and the group it joins
            '<small class="promo-to">Tier ' + ROMAN[q.tier] + (q.group ? ' · ' + esc(q.group) : '') + '</small></button>';
        });
        if (C.takesHonours(p)) {
          var hc = C.canTakeHonour(e, co);
          acts += '<button class="lnk good" data-honour="' + e.rid + '"' +
            (hc.ok ? '' : ' disabled title="' + esc(hc.why || '') + '"') + '>' + C.words(co).honour + ' · ' +
            C.honourCost(e, co) + ' EXP</button>';
        } else {
          var uc = C.canTakeUpgrade(e);
          acts += '<button class="lnk good" data-upgrade="' + e.rid + '"' +
            (uc.ok ? '' : ' disabled title="' + esc(uc.why || '') + '"') + '>Upgrade · 10 EXP</button>';
        }
      return acts;
    }
    // whether a unit can afford anything it could spend its experience on
    function canSpend(e, co) { return /<button(?![^>]*disabled)[^>]*data-(promote|honour|upgrade)=/.test(spendActs(e, co)); }
    function spendList(co) {
      var h = '<div class="dlist">';
      var any = false;
      co.roster.slice().sort(function (a, b) { return b.exp - a.exp; }).forEach(function (e) {
        var acts = spendActs(e, co);
        if (acts) { any = true; h += entryCard(e, co, { actions: acts }); }
      });
      h += '</div>';
      if (!any) h += '<p class="dnote">Nothing to spend on yet — units earn experience by fighting.</p>';
      return h;
    }

    function recruitList(co) {
      var top = Math.min(5, co.tier + 2);
      // the list is what may be recruited, up to two Tiers above the force's own; the money is on the panel's head
      var h = '<div class="cat tall">';
      var groups = {}, order = [];
      ourList(co).forEach(function (p) {
        if (p.tier > top) return;
        if (C.isTurretP(p) || p.noSlot) return;      // fielded with a contract's force, never recruited
        if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
        groups[p.group].push(p);
      });
      order.forEach(function (g) {
        h += '<h4>' + esc(g) + '</h4>';
        groups[g].forEach(function (p) {
          var chk = C.canRecruit(co, p.key);
          var cost = C.recruitCost(co, p.key);
          var price = cost ? cost + ' ' + C.money(co) : 'free', row = root.PMCUi.unitRow;
          h += row('class="cu" data-recruit="' + p.key + '"' + (chk.ok ? '' : ' disabled title="' + esc(chk.why) + '"'), p.tier,
            '<b>' + esc(p.name) + '</b>', esc(statLine(p) + ((p.rules || []).length ? ' · ' + p.rules.join(', ') : '')), price);
          /* the Riders upgrade, "decided when that unit is recruited. The decision is
             final" (p. 97): a squad that may take it is recruited on foot or mounted */
          if (R.canRide(p)) h += row('class="cu cu-riders" data-recruit="' + p.key + '" data-asriders="1"' + (chk.ok ? '' : ' disabled'), p.tier,
            '<b>' + esc(p.name) + ' \u2014 Riders</b>', 'Half the models, Movement 10 and the Riders rule; final once recruited', price);
          // the same hull or craft, flown remotely (p. 37)
          if (R.canBeDrone(p)) h += row('class="cu cu-drone" data-recruit="' + p.key + '" data-asdrone="1"' + (chk.ok ? '' : ' disabled'), p.tier,
            '<b>' + esc(p.name) + ' — drone</b>', '+1 Structure, no crew, no experience; can be hacked', price);
        });
      });
      h += '</div>';
      return h;
    }

    return {
      dossierPanel: dossierPanel, memorialList: memorialList, spendActs: spendActs
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCDossierRoster;
})(typeof window !== 'undefined' ? window : global);
