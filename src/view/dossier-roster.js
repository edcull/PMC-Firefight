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
    function rosterBody(co) {
      var h = '';
      if (E.rosterTab === 'units') {
        // every unit on the books has its soldiers named; an old save gets them now
        var named = false;
        co.roster.forEach(function (e) { if (C.menOf(e, co)) named = true; });
        if (named) save();
        var fk = co === E.camp.companies.A ? 'A' : 'B', shown = co.roster.filter(function (e) { return E.unitPasses(e, fk); });
        h += '<div class="dlist">';
        if (!shown.length) h += '<p class="cpstat">No unit has any yet.</p>';
        // the command first — it earns no experience and carries no honours or traumas — then by Tier and experience
        shown.slice().sort(function (a, b) {
          var la = C.isLeaderP(profile(a.key)) ? 1 : 0, lb = C.isLeaderP(profile(b.key)) ? 1 : 0;
          return lb - la || profile(b.key).tier - profile(a.key).tier || b.exp - a.exp;
        }).forEach(function (e) {
          var acts = '<button class="lnk" data-rename="' + e.rid + '">Rename</button>';
          var open = !!E.menOpen[e.rid];
          // enough experience for something: a Promote button, opening the choices in a window
          var spend = canSpend(e, co) ? '<button class="lnk good" data-promo="' + e.rid + '">Promote</button>' : '';
          var dis = C.canDisband(co, e);
          acts += '<button class="lnk warn" data-disband="' + e.rid + '"' + (dis.ok ? '' : ' disabled title="' + esc(dis.why) + '"') + '>Disband</button>';
          if (spend) acts += spend;
          h += entryCard(e, co, { actions: acts, men: open ? detailPanel(e, co) : '', expand: true });
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
        var pct = Math.round(st.pct * 1000) / 10;
        return '<div class="dloss"><b>' + pct + '%</b> lost <span>' + st.lost + ' of ' + st.served + ' ' + st.unit + '</span></div>';
      }).join('');
    }
    function memorialList(co) {
      if (co.faction === 'bugs') return biomassList(co);
      var list = co.memorial || [];
      if (!list.length) return lossLine(co) + '<p class="dnote">No one has been lost yet.</p>';
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
          if (seen[key]) { seen[key].count += m.count || 0; seen[key].squads++; return; }
          seen[key] = { anon: true, type: m.type, noun: m.noun, count: m.count || 0, squads: 1, unit: m.unit };
          out.push(seen[key]);
        });
        return out;
      }
      order.forEach(function (n) {
        var ms = mergeAnon(battles[n]), first = battles[n][0];
        var sc = SCx && SCx.SCENARIOS && SCx.SCENARIOS[first.scenario];
        h += '<div class="dmem"><div class="dmem-head">Campaign turn ' + n +
          (first.against ? ' · against ' + esc(first.against) : '') + (sc ? ' · ' + esc(sc.name) : '') +
          '<span class="mk">' + ms.reduce(function (k, m) { return k + (m.count || 1); }, 0) + '</span></div><ol class="dmem-list">' +
          ms.map(function (m) {
            if (m.anon) {
              return '<li><b>' + esc(m.type) + '</b> <span class="dmen-rank">\u00d7 ' + m.count + ' ' + esc(m.noun || 'Esh-Aven') + '</span>' +
                (m.squads > 1 ? '<span class="dmem-type">' + m.squads + ' squads</span>'
                  : m.unit && m.unit !== m.type ? '<span class="dmem-type">' + esc(m.unit) + '</span>' : '') + '</li>';
            }
            return '<li><span class="dmen-rank">' + esc(m.rank) + '</span> <b>' + esc(m.name) + '</b>' +
              '<span class="dmem-type">' + esc(m.type) + (m.unit && m.unit !== m.type ? ' \u00b7 ' + esc(m.unit) : '') +
              ' \u00b7 turn ' + (m.turn || 1) + ' of the battle</span></li>';
          }).join('') + '</ol></div>';
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
      var cols = [cell('Tier', u.tier, u.tier), cell(mach ? 'Size' : 'Men', mach ? 1 : u.size, mach ? 1 : was.size),
        cell('Move', u.move, was.move, inch), cell('FP', u.fp, was.fp), cell('Range', u.range || null, was.range || null, inch),
        cell('Def', u.def, was.def), cell('Asslt', u.assault, was.assault),
        mach ? cell('Str', u.str, was.str) : cell('Mor', u.morale, was.morale)];
      if (u.turn != null) cols.push(cell('Turn', u.turn, was.turn));
      var h = '<div class="ddet">';
      h += '<table class="ddet-stats"><tr>' + cols.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') +
        '</tr><tr>' + cols.map(function (c) {
          return '<td' + (c.d ? ' class="' + (c.d > 0 ? 'up' : 'down') + '"' : '') + '>' + esc(c.v) +
            (c.d ? '<sup>' + (c.d > 0 ? '+' : '') + c.d + '</sup>' : '') + '</td>';
        }).join('') + '</tr></table>';
      if (u.defPierced != null) h += '<p class="ddet-note">Defence ' + u.defPierced + ' against Anti-tank and Gauss weapons.</p>';
      /* What it rides, changed here between battles: the Riders upgrade where
         the unit may take it, and a motorbike, grav bike or horse once it rides. */
      if (R.canRide(p) || R.canMount(p, riding)) {
        h += '<h5>Mounted</h5><div class="ddet-ride">';
        if (R.canRide(p)) h += '<button class="lnk' + (riding ? ' on' : '') + '" data-eriders="' + e.rid + '">' +
          (riding ? 'Mounted (Riders) \u2014 dismount' : 'On foot \u2014 take the Riders upgrade') + '</button>';
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
          var gained = was.rules.indexOf(r) < 0;
          return '<li><b>' + esc(d.name) + '</b>' + (gained ? ' <span class="mk good">earned</span>' : '') +
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
          '<button class="lnk" data-rsoldier="' + e.rid + '" data-i="' + i + '">Rename</button></li>';
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
            (c.kUC ? ' + ' + c.kUC + ' ' + C.money(co) : '') + '</button>';
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
      ourList().forEach(function (p) {
        if (p.tier > top) return;
        if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
        groups[p.group].push(p);
      });
      order.forEach(function (g) {
        h += '<h4>' + esc(g) + '</h4>';
        groups[g].forEach(function (p) {
          var chk = C.canRecruit(co, p.key);
          var cost = C.recruitCost(co, p.key);
          h += '<button class="cu" data-recruit="' + p.key + '"' +
            (chk.ok ? '' : ' disabled title="' + esc(chk.why) + '"') + '>' +
            '<span class="t">' + ROMAN[p.tier] + '</span>' +
            '<span><b>' + esc(p.name) + '</b><small>' + esc(statLine(p)) + '</small></span>' +
            '<span class="st">' + (cost ? cost + ' ' + C.money(co) : 'free') + '</span></button>';
          // the same hull or craft, flown remotely (p. 37)
          if (R.canBeDrone(p)) h += '<button class="cu cu-drone" data-recruit="' + p.key + '" data-asdrone="1"' +
            (chk.ok ? '' : ' disabled') + '><span class="t">' + ROMAN[p.tier] + '</span>' +
            '<span><b>' + esc(p.name) + ' — drone</b><small>+1 Structure, no crew, no experience; can be hacked</small></span>' +
            '<span class="st">' + (cost ? cost + ' ' + C.money(co) : 'free') + '</span></button>';
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
